const parseXlsx = require('excel').default;
const fs = require('fs-extra');
const path = require('path');
const glob = require("glob");
const async = require("async");
const { exec, spawn } = require('child_process');
const os = require('os');
const outPath = 'dynamic/extend/cats_category';

class CatsCategoryMaker {

    constructor() {
        this.cwd = {
            category: path.resolve(__dirname, '../../../../art/cats_category')
        };
        this.start = Date.now();
        this.entryList = this.findAllEntry();
        this.makeAllNormal(()=>{
            const total = Date.now() - this.start;
            Editor.success(`共${this.entryList.length}个工程全部完成!总用时${(total/1000).toFixed(1)}s, 平局用时${(total/(this.entryList.length*1000)).toFixed(1)}s`);
        });
    }

    findAllEntry() {
        const ret = [];
        const list = glob.sync(`${this.cwd.category}/*`, {});
        list.forEach((dir)=>{
            const stat = fs.statSync(dir);
            if( stat.isDirectory() ){
                const basename = path.basename(dir);
                const thumb = glob.sync(`${dir}/thumb.png`, {});
                if( thumb && thumb.length == 1 ){
                    ret.push({
                        basename: basename,
                        basePath: dir
                    });
                }
            }
        });
        return ret;
    }

    makeAllNormal(done){
        async.eachOfSeries(this.entryList, (entry, index, cb)=>{
            fs.copySync(path.resolve(entry.basePath, 'thumb.png'), path.resolve(Editor.projectInfo.path, `./assets/resources/${outPath}/textures/${entry.basename}/thumb.png`));
            fs.copySync(path.resolve(entry.basePath, `${entry.basename}.png`), path.resolve(Editor.projectInfo.path, `./assets/resources/${outPath}/textures/${entry.basename}/${entry.basename}.png`));
            this._refreshTexture(entry.basename);
            cb();
        }, ()=>{
            done();
        });
    }

    _refreshTexture(name){
        const basedir = `assets/resources/${outPath}/textures`;
        Editor.assetdb.refresh(`db://${basedir}/${name}`);
        Editor.assetdb.refresh(`db://${basedir}/${name}/thumb.png`);
        Editor.assetdb.refresh(`db://${basedir}/${name}/${name}.png`);
    }

}

module.exports = function () {
    new CatsCategoryMaker();
}