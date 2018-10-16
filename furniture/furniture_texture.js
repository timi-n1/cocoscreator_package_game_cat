const parseXlsx = require('excel').default;
const fs = require('fs-extra');
const path = require('path');
const glob = require("glob");
const async = require("async");
const { exec, spawn } = require('child_process');
const sizeOf = require('image-size');
const Jimp = require("jimp");
const os = require('os');
const outPath = 'dynamic/extend/furnitures';

class FurnitureMaker {

    constructor() {
        this.jsonCache = {};
        this.config = {};
        this.cwd = {
            furnitures: path.resolve(__dirname, '../../../../art/furnitures')
        };
        this.start = Date.now();
        this.entryList = this.findAllEntry();
        this.preMakeAllSpineProject(() => {
            this.makeAllSpineProject(() => {
                this.makeAllNormal(() => {
                    const total = Date.now() - this.start;
                    fs.writeFileSync(path.resolve(Editor.projectInfo.path, `./assets/script/data/config/config.furnitures_res.ts`), `export default ${JSON.stringify(this.config, null, 4)}`);
                    Editor.assetdb.refresh(`db://assets/script/data/config/config.furnitures_res.ts`);
                    Editor.success(`共${this.entryList.length}个工程全部完成!总用时${(total / 1000).toFixed(1)}s, 平局用时${(total / (this.entryList.length * 1000)).toFixed(1)}s`);
                });
            });
        });

    }

    findAllEntry() {
        const ret = [];
        const list = glob.sync(`${this.cwd.furnitures}/*`, {});
        list.forEach((dir) => {
            const stat = fs.statSync(dir);
            if (stat.isDirectory()) {
                const basename = path.basename(dir);
                const tex = glob.sync(`${dir}/${basename}.png`, {});
                const spine = glob.sync(`${dir}/${basename}.spine`, {});
                if ((tex && tex.length == 1) || (spine && spine.length == 1)) {
                    let json = {
                        basename: basename,
                        isSpine: false
                    };
                    const spine = glob.sync(`${dir}/${basename}.spine`, {});
                    if (spine && spine.length == 1) {
                        json.isSpine = true;
                        const itemList = glob.sync(`${dir}/skins/*`, {});
                        itemList.forEach((item) => {
                            const itemStat = fs.statSync(item);
                            if (itemStat.isDirectory()) {
                                json = {
                                    basename: path.basename(item),
                                    isSpine: true,
                                    spinePath: spine[0],
                                    jsonPath: basename,
                                    texturePath: item,
                                    basePath: dir
                                };
                                ret.push(json);
                            }
                        });
                    }
                    else {
                        json.basePath = dir;
                        ret.push(json);
                    }
                }
            }
        });
        return ret;
    }

    //预处理所有的spine工程，导出为
    preMakeAllSpineProject(done) {
        async.eachOfSeries(this.entryList, (entry, index, cb) => {
            if (!entry.isSpine) {
                cb();
                return;
            }
            if (this.jsonCache[entry.jsonPath]) {
                cb();
                return;
            }
            const outtemp = path.resolve(Editor.projectInfo.path, `./temp/furnitures_spines_${entry.jsonPath}`);
            fs.emptyDirSync(outtemp);
            const ls = spawn('/Applications/Spine/Spine.app/Contents/MacOS/Spine', [
                '--proxy', 'dev-proxy.oa.com:8080',
                '-i', entry.spinePath,
                '-o', outtemp,
                '-e', path.resolve(__dirname, './export.json')
            ]);

            ls.stdout.on('data', (data) => {
                if (data && data.length > 2) {
                    Editor.log(`spine: ${data}`);
                }
            });

            ls.stderr.on('data', (data) => {
                Editor.log(`spine: ${data}`);
            });

            ls.on('close', (code) => {
                const outlist = glob.sync(`${outtemp}/*.json`, {});
                const tempname = path.parse(outlist[0]).name;
                //重命名
                glob.sync(`${outtemp}/*.*`, {}).forEach((oldfile) => {
                    fs.renameSync(oldfile, path.resolve(outtemp, `${entry.jsonPath}${path.extname(oldfile)}`));
                });
                //替换小图
                fs.copySync(path.resolve(__dirname, './empty.png'), path.resolve(outtemp, `./${entry.jsonPath}.png`));
                //替换atlas文本
                const atlasFile = path.resolve(outtemp, `./${entry.jsonPath}.atlas`);
                const atlasText = fs.readFileSync(atlasFile).toString().replace(`${tempname}.png`, `${entry.jsonPath}.png`);
                fs.writeFileSync(atlasFile, atlasText);
                //整体拷贝
                fs.copySync(outtemp, path.resolve(Editor.projectInfo.path, `./assets/resources/${outPath}/skeletondata/${entry.jsonPath}`));
                this._refreshJson(entry.jsonPath);
                Editor.success(`[成功]${entry.spinePath}`);
                this.jsonCache[entry.jsonPath] = true;
                setImmediate(cb);
            });
        }, () => {
            done();
        });
    }

    makeAllSpineProject(done) {
        async.eachOfSeries(this.entryList, (entry, index, cb) => {
            if (!entry.isSpine) {
                cb();
                return;
            }
            const jsonfile = path.resolve(Editor.projectInfo.path, `./assets/resources/${outPath}/skeletondata/${entry.jsonPath}/${entry.jsonPath}.json`);
            const json = JSON.parse(fs.readFileSync(jsonfile).toString());
            const animations = Object.keys(json.animations);
            this.config[entry.basename] = {
                spine: true,
                json: entry.jsonPath,
                animations: animations
            };
            this.makeTexture(`${entry.texturePath}/*.png`, entry.basename, () => {
                fs.copySync(path.resolve(entry.basePath, `./thumb/${entry.basename}.png`), path.resolve(Editor.projectInfo.path, `./assets/resources/${outPath}/textures/${entry.basename}/thumb.png`));
                this._refreshAtlas(entry.basename);
                this._refreshThumb(entry.basename);
                Editor.success(`[成功]${entry.texturePath}`)
                cb();
            });
        }, () => {
            done();
        });
    }

    makeTexture(assets, name, done) {
        const app = path.resolve(Editor.projectInfo.path, `./tools/${os.platform()}/TexturePacker.app/Contents/MacOS/TexturePacker`)
        const png = path.resolve(Editor.projectInfo.path, `./assets/resources/${outPath}/skeletontexture/${name}/${name}.png`);
        const plist = path.resolve(Editor.projectInfo.path, `./assets/resources/${outPath}/skeletontexture/${name}/${name}.atlas`);
        const maxwidth = 2048;
        const maxheight = 2048;
        const cmd = `${app} --sheet ${png} --data ${plist} --allow-free-size --smart-update --trim --padding 2 --scale 1.0 --extrude 0 --enable-rotation --max-width ${maxwidth} --max-height ${maxheight} --format libgdx ${assets}`;
        // Editor.warn(cmd);
        exec(cmd, (err, stdout, stderr) => {
            if (!err) {
                done();
                return;
            }
            Editor.warn(err);
            Editor.warn(stdout);
            Editor.warn(stderr);
        });
    }

    makeAllNormal(done) {
        async.eachOfSeries(this.entryList, (entry, index, cb) => {
            if (entry.isSpine) {
                cb();
                return;
            }

            // fs.copySync(path.resolve(entry.basePath, 'thumb.png'), path.resolve(Editor.projectInfo.path, `./assets/resources/${outPath}/textures/${entry.basename}/thumb.png`));
            // fs.copySync(path.resolve(entry.basePath, `${entry.basename}.png`), path.resolve(Editor.projectInfo.path, `./assets/resources/${outPath}/textures/${entry.basename}/${entry.basename}.png`));

            let fileImage = path.resolve(entry.basePath, `${entry.basename}.png`);
            let fileImageThumb = path.resolve(entry.basePath, `thumb.png`);
            let fileBig = path.resolve(Editor.projectInfo.path, `./assets/resources/${outPath}/textures/${entry.basename}/${entry.basename}.png`);
            let fileIcon = path.resolve(Editor.projectInfo.path, `./assets/resources/${outPath}/textures/${entry.basename}/thumb.png`);
            // let dimensions = sizeOf(fileImage);
            let scaleRate = 1/3.51;
            let isCustomIcon = false;

            async.parallel([
                (cb0) => {
                    //大图
                    Jimp.read(fileImage, (err, lenna) => {
                        if (err) throw err;
                        lenna.scale(scaleRate).write(fileBig);
                        cb0();
                    });
                },
                (cb0) => {
                    //icon，先查找是否有thumb.png
                    if( fs.existsSync(fileImageThumb) ){
                        fs.copySync(fileImageThumb, fileIcon);
                        isCustomIcon = true;
                        cb0();
                    }
                    else{
                        Jimp.read(fileImage, (err, lenna) => {
                            if (err) throw err;
                            lenna.scaleToFit(135, 135).write(fileIcon);
                            cb0();
                        });
                    }
                }
            ], () => {
                this._refreshTexture(entry.basename);
                //猫粮盆的特殊处理
                async.eachOfSeries([0,1,2,3], (index0, i, cb9)=>{
                    const f = path.resolve(entry.basePath, `${index0}.png`);
                    if (fs.existsSync(f)) {
                        Jimp.read(f, (err, lenna) => {
                            if (err) throw err;
                            lenna.scale(scaleRate).write(path.resolve(Editor.projectInfo.path, `./assets/resources/${outPath}/textures/${entry.basename}/${index0}.png`));
                            cb9();
                        });
                        this._refreshFood(entry.basename, index0);
                    }
                    else{
                        cb9();
                    }
                }, ()=>{
                    this.config[entry.basename] = {
                        spine: false,
                    };
                    setTimeout(() => {
                        Editor[isCustomIcon?'warn':'log'](`[家具]${entry.basename}`);
                        cb();
                    }, 20);
                });
            });

        }, () => {
            done();
        });
    }

    _refreshJson(name) {
        const basedir = `assets/resources/${outPath}/skeletondata`;
        Editor.assetdb.refresh(`db://${basedir}/${name}`);
        Editor.assetdb.refresh(`db://${basedir}/${name}`);
        Editor.assetdb.refresh(`db://${basedir}/${name}`);
        Editor.assetdb.refresh(`db://${basedir}/${name}/${name}.json`);
        Editor.assetdb.refresh(`db://${basedir}/${name}/${name}.atlas`);
        Editor.assetdb.refresh(`db://${basedir}/${name}/${name}.png`);
    }

    _refreshAtlas(name) {
        const basedir = `assets/resources/${outPath}/skeletontexture`;
        Editor.assetdb.refresh(`db://${basedir}/${name}`);
        Editor.assetdb.refresh(`db://${basedir}/${name}/${name}.atlas`);
        Editor.assetdb.refresh(`db://${basedir}/${name}/${name}.png`);
    }

    _refreshThumb(name) {
        const basedir = `assets/resources/${outPath}/textures`;
        Editor.assetdb.refresh(`db://${basedir}/${name}`);
        Editor.assetdb.refresh(`db://${basedir}/${name}/thumb.png`);
    }

    _refreshTexture(name) {
        const basedir = `assets/resources/${outPath}/textures`;
        Editor.assetdb.refresh(`db://${basedir}/${name}`);
        Editor.assetdb.refresh(`db://${basedir}/${name}/thumb.png`);
        Editor.assetdb.refresh(`db://${basedir}/${name}/${name}.png`);
    }

    _refreshFood(name, i) {
        const basedir = `assets/resources/${outPath}/textures`;
        Editor.assetdb.refresh(`db://${basedir}/${name}/${i}.png`);
    }

}

module.exports = function () {
    new FurnitureMaker();
}