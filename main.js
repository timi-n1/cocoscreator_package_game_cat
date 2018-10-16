'use strict';

let buildPath = null;
let thisProjectName = 'cats';

var isOK = function(done){
    const path = require('path');
    const fs = require('fs');
    const packagePath = path.resolve(Editor.projectInfo.path, `./package.json`);
    const json = JSON.parse( fs.readFileSync(packagePath).toString() );
    if( json.name == thisProjectName ){
        done && done();
    }
    else{
        Editor.error(`该项目为${json.name}，插件绑定项目为${thisProjectName}`);
    }
};

module.exports = {
    load() {
        // 当 package 被正确加载的时候执行
    },

    unload() {
        // 当 package 被正确卸载的时候执行
    },

    messages: {
        'config_xlsx'() {
            isOK(()=>{
                require('./excel/excel')();
            });
        },
        'config_furniture_position'() {
            isOK(()=>{
                require('./yardconfig/index')('furniture');
            });
        },
        'config_cats_position'() {
            isOK(()=>{
                require('./yardconfig/index')('cats');
            });
        },
        'config_toys_position'() {
            isOK(()=>{
                require('./yardconfig/index')('toys');
            });
        },
        'spine_maker'() {
            isOK(()=>{
                require('./cats_alive/spine')();
            });
        },
        'spine_texture_maker'() {
            isOK(()=>{
                require('./cats_alive/spine_texture')();
            });
        },
        'furniture_texture_maker'() {
            isOK(()=>{
                require('./furniture/furniture_texture')(); 
            });
        },
        'toys_texture_maker'() {
            isOK(()=>{
                require('./toys/toys_maker')(); 
            });
        },
        'food_texture_maker'() {
            isOK(()=>{
                require('./food/food_maker')();
            });
        },
        'cats_category_maker'() {
            isOK(()=>{
                require('./cats_category/cats_category')(); 
            });
        },
        'editor:build-start'(evt, data) {
            buildPath = `${data.dest}`;
            const path = require('path');
            const fs = require('fs');
            if (fs.existsSync(path.resolve(__dirname, './autobuild.txt'))) {
                const file = path.resolve(Editor.projectInfo.path, `./assets/lib/const-manager.js`);
                const txt = fs.readFileSync(file).toString();
                const build = parseInt(txt.match(/\"BUILD\"\:\s\"(\d+)\"/)[1], 10) + 1;
                const newtxt = txt.replace(/\"BUILD\"\:\s\"\d+\"/, `"BUILD": "${build}"`)
                Editor.success('build=' + build);
                fs.writeFileSync(file, newtxt);
            }
        }
    },
};