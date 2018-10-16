const fs = require('fs');
const path = require('path');
const request = require('request');

class YardConfigParser{

    constructor(type){
        const src = path.resolve(__dirname, '../../../../cats/assets/editor/__YardConfig.fire');
        const output = path.resolve(__dirname, `../../../../cats/assets/script/data/position/position.${type}.ts`);
        const data = JSON.parse(fs.readFileSync(src).toString());
        const keyMap = {
            furniture: {
                chr: 'F_',
                maker: this.furnitureMaker
            },
            cats: {
                chr: 'C_'
            },
            toys: {
                chr: 'T_'
            }
        };
        const chr = keyMap[type].chr;
        const ret = [];
        let id = 1;
        let zindex = 1;
        data.forEach((node)=>{
            if( node.__type__ != 'cc.Node' ){
                return;
            }
            if( node._name.slice(0,2) != chr ){
                return;
            }
            const json = {
                name: node._name.replace(chr, ''),
                x: node._position.x,
                y: node._position.y
            };
            if( keyMap[type].maker ){
                keyMap[type].maker(data, node, json);
            }
            if( 'furniture' == type ){
                json.zindex = zindex++;
            }
            json.id = id++;
            ret.push(json);
        });
        let filename = `position.${type}.ts`;
        let datastring = `export default ${JSON.stringify(ret, null, 4)}`;

        fs.writeFileSync(output, datastring);
        Editor.success('成功');
        Editor.assetdb.refresh(`db://assets/script/data/position`);
        Editor.assetdb.refresh(`db://assets/script/data/position/${filename}`);
        this.upload(`position.${type}.js`, JSON.stringify(ret));
    }

    upload(filename, data, done) {
        request.post('http://10.54.238.67:8080/n/cat/config', { form: { filename: filename, data: data } }, (err, httpResponse, body) => {
            Editor.log('上传到后台:' + body);
            done && done();
        });
    }

    furnitureMaker(data, node, json){
        node._components.forEach((item)=>{
            const id = item.__id__;
            const com = data[id];
            if( com.__type__ == 'cc.Sprite' ){
                return;
            }
            if( com.subtype ){
                json.subtype = com.subtype;
                json.fixedTop = com.fixedTop
                json.fixedBottom = com.fixedBottom
            }
        });
    }

}

module.exports = function(type){
    new YardConfigParser(type);
};