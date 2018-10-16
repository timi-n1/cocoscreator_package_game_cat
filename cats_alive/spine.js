const parseXlsx = require('excel').default;
const fs = require('fs-extra');
const path = require('path');
const glob = require("glob");
const async = require("async");
const { spawn } = require('child_process');

const outPath = 'dynamic/extend/cats_alive';

class SpineMaker {

    constructor() {
        this.cwd = {
            spine: path.resolve(__dirname, '../../../../art/cats_alive')
        };
        this.entryList = this.findAllEntry();
        this.start = Date.now();
        this.makeAllSpineProject(()=>{
            const total = Date.now() - this.start;
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
                    const json = {
                        fullpath: dir,
                        basename: path.basename(dir),
                        spineproject: spineList[0],
                        skins: glob.sync(`${dir}/skins/*`, {})
                    };
                    ret.push(json);
                }
            }
        });
        return ret;
    }

    makeAllSpineProject(done){
        const outtemp = path.resolve(Editor.projectInfo.path, './temp/spines');
        async.eachOfSeries(this.entryList, (entry, index, cb)=>{
            fs.emptyDirSync(outtemp);
            // Editor.log(entry.spineproject);
            const ls = spawn('/Applications/Spine/Spine.app/Contents/MacOS/Spine', [
                '--proxy', 'web-proxy.oa.com:8080',
                '-i', entry.spineproject,
                '-o', outtemp,
                '-e', path.resolve(__dirname, './export.json')
            ]);

            ls.stdout.on('data', (data) => {
                if( data && data.length > 2 ){
                    // Editor.log(`spine: ${data}`);
                }
            });

            ls.stderr.on('data', (data) => {
                Editor.log(`spine: ${data}`);
            });
            
            ls.on('close', (code) => {
                const outlist = glob.sync(`${outtemp}/*.json`, {});
                const tempname = path.parse(outlist[0]).name;
                //重命名
                glob.sync(`${outtemp}/*.*`, {}).forEach((oldfile)=>{
                    if( oldfile.slice(-5) === '.json' ){
                        //校验json里是否有head的bone和slot
                        const jsonData = JSON.parse(fs.readFileSync(oldfile).toString());
                        let bone = false;
                        let slot = false;
                        let scale = false;
                        jsonData.bones.forEach((bone_)=>{
                            if( bone_.name == 'head' ){
                                bone = true;
                            }
                            if( bone_.name == 'root' ){
                                if( bone_.scaleX < 1.0 || bone_.scaleY < 1.0 ){
                                    scale = [bone_.scaleX, bone_.scaleY];
                                }
                            }
                        });
                        jsonData.slots.forEach((slot_)=>{
                            if( slot_.name == 'head' ){
                                slot = true;
                            }
                        });
                        if( !bone || !slot ){
                            Editor.error(`${oldfile}的head检查有问题,bone=${bone},slot=${slot}`);
                        }
                        if( scale ){
                            Editor.error(`${oldfile}的scale检查有问题, scale=${JSON.stringify(scale)}`);
                        }
                        //检查大写,缩放
                        if( path.basename(oldfile).toLowerCase() != path.basename(oldfile) ){
                            Editor.error(`${oldfile}发现大写命名!`);
                        }
                        //输出动画
                        Editor.log(`包含动画${Object.keys(jsonData.animations)}`);
                        
                    }
                    fs.renameSync(oldfile, path.resolve(outtemp, `${entry.basename}${path.extname(oldfile)}`));
                });
                //替换小图
                fs.copySync(path.resolve(__dirname, './empty.png'), path.resolve(outtemp, `./${entry.basename}.png`));
                //替换atlas文本
                const atlasFile = path.resolve(outtemp, `./${entry.basename}.atlas`);
                const atlasText = fs.readFileSync(atlasFile).toString().replace(`${tempname}.png`, `${entry.basename}.png`);
                fs.writeFileSync(atlasFile, atlasText);
                //整体拷贝
                fs.copySync(outtemp, path.resolve(Editor.projectInfo.path, `./assets/resources/${outPath}/skeletondata/${entry.basename}`));
                this._refreshJson(entry.basename);
                Editor.success(`[${index+1}/${this.entryList.length}]${entry.spineproject}成功!`);
                setImmediate(cb);
            });
        }, ()=>{
            done();
        });
    }

    _refreshJson(name){
        const basedir = `assets/resources/${outPath}/skeletondata`;
        Editor.assetdb.refresh(`db://${basedir}/${name}`);
        Editor.assetdb.refresh(`db://${basedir}/${name}/${name}.json`);
        Editor.assetdb.refresh(`db://${basedir}/${name}/${name}.atlas`);
        Editor.assetdb.refresh(`db://${basedir}/${name}/${name}.png`);
    }

}

module.exports = function () {
    new SpineMaker();
}
