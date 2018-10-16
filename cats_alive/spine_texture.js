const parseXlsx = require('excel').default;
const fs = require('fs-extra');
const path = require('path');
const glob = require("glob");
const async = require("async");
const { exec } = require('child_process');
const os = require('os');
const thumbNum = 0.12;
const outPath = 'dynamic/extend/cats_alive';

class SpineMaker {

    constructor() {
        this.config = {};
        this.cwd = {
            spine: path.resolve(__dirname, '../../../../art/cats_alive')
        };
        this.entryList = this.findAllEntry();
        this.start = Date.now();
        this.makeAllSpineProject(()=>{
            const total = Date.now() - this.start;
            fs.writeFileSync(path.resolve(Editor.projectInfo.path, `./assets/script/data/config/config.spine.ts`), `export default ${JSON.stringify(this.config, null, 4)}`);
            Editor.assetdb.refresh(`db://assets/script/data/config/config.spine.ts`);
            Editor.success(`共${this.entryList.length}个工程全部完成!总用时${(total/1000).toFixed(1)}s, 平局用时${(total/(this.entryList.length*1000)).toFixed(1)}s`);
        });
    }

    findAllEntry() {
        const ret = [];
        const list = glob.sync(`${this.cwd.spine}/*`, {});
        list.forEach((dir)=>{
            const stat = fs.statSync(dir);
            if( stat.isDirectory() ){
                const spineList = glob.sync(`${dir}/*.spine`, {});
                if( spineList && spineList.length == 1 ){
                    const animations = [];
                    const basename = path.basename(dir);
                    const jsonContent = fs.readJsonSync(path.resolve(Editor.projectInfo.path, `./assets/resources/${outPath}/skeletondata/${basename}/${basename}.json`));
                    Object.keys(jsonContent.animations).forEach((anima)=>{
                        animations.push(anima.toLowerCase());
                    });
                    glob.sync(`${dir}/skins/*`, {}).forEach((skin)=>{
                        ret.push({
                            fullpath: dir,
                            basename: basename,
                            animations: animations,
                            skin: skin
                        });
                    });
                }
            }
        });
        return ret;
    }

    makeAllSpineProject(done){
        async.eachOfSeries(this.entryList, (entry, index, cb)=>{
            const catname = path.basename(entry.skin);
            const name = `${entry.basename}_${catname}`;
            entry.animations.forEach((anima)=>{
                this.config[catname] = this.config[catname] || {};
                this.config[catname][anima] = entry.basename;
                // this.config[`${catname}_${anima}`] = entry.basename;
            });
            this.makeTexture(`${entry.skin}/*.png`, name, ()=>{
                // this.makeTexture(`${entry.skin}/*.png`, name, true, ()=>{
                    this._refresh(name);
                    Editor.success(`[成功]${entry.skin}`)
                    cb();
                // });
            });
        }, ()=>{
            done();
        });
    }

    makeTexture(assets, name, done){
        const app = path.resolve(Editor.projectInfo.path, `./tools/${os.platform()}/TexturePacker.app/Contents/MacOS/TexturePacker`)
        const png = path.resolve(Editor.projectInfo.path, `./assets/resources/${outPath}/texture/${name}/normal/${name}.png`);
        const plist = path.resolve(Editor.projectInfo.path, `./assets/resources/${outPath}/texture/${name}/normal/${name}.atlas`);
        const maxwidth = 4096;
        const maxheight = 4096;
        const cmd = `${app} --opt RGBA8888 --sheet ${png} --data ${plist} --allow-free-size --smart-update --premultiply-alpha --trim-mode None --padding 2 --scale ${thumbNum} --extrude 0 --enable-rotation --max-width ${maxwidth} --max-height ${maxheight} --format libgdx ${assets}`;
        // Editor.warn(cmd);
        exec(cmd, (err, stdout, stderr) => {
            if( !err ){
                done();
                return;
            }
            Editor.warn(err);
            Editor.warn(stdout);
            Editor.warn(stderr);
        });
    }

    _refresh(name){
        const basedir = `assets/resources/${outPath}/texture`;
        Editor.assetdb.refresh(`db://${basedir}/${name}`);
        Editor.assetdb.refresh(`db://${basedir}/${name}/normal`);
        Editor.assetdb.refresh(`db://${basedir}/${name}/normal/${name}.atlas`);
        Editor.assetdb.refresh(`db://${basedir}/${name}/normal/${name}.png`);
        // Editor.assetdb.refresh(`db://${basedir}/${name}/thumb`);
        // Editor.assetdb.refresh(`db://${basedir}/${name}/thumb/${name}.atlas`);
        // Editor.assetdb.refresh(`db://${basedir}/${name}/thumb/${name}.png`);
    }

}

module.exports = function () {
    new SpineMaker();
}