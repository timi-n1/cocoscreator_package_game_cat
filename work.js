
function computePackageSize(buildPath){
    const glob = require("glob");
    const fs = require('fs-extra');

    let sizeTotal = 0;

    glob(`${buildPath}/**/*.*`, {}, function (er, files) {
        files.forEach((file) => {
            sizeTotal += fs.statSync(file).size;
        });
        Editor.success(`[全部完成]初始包体共${files.length}个文件，总大小${(sizeTotal/1024).toFixed(0)}KB!`);
    })
}

module.exports = function (buildPath) {
    Editor.success('[微信小游戏]开始自动处理资源到cdn');
    const path = require('path');
    const tar = require('tar');
    const fs = require('fs-extra');
    const request = require('request');
    const glob = require("glob");

    let remotePath = '';//从package.json中读取cdnPath字段
    const cwd = buildPath;
    const package = path.resolve(__dirname, '../../package.json');
    const resPath = path.resolve(cwd, `./res/raw-assets/resources/dynamic`);
    const removePathList = [
        './res/raw-assets/resources/dynamic',
        './res/raw-internal'
    ];
    const gamejsPath = path.resolve(cwd, `./game.js`);
    const tarFile = path.resolve(cwd, `./cdn_${Date.now().toString().slice(-6)}.tar.gz`);

    //在import目录寻找较大的文件，加入到removePathList
    const list = glob.sync(path.resolve(cwd, `./res/import/**/*.json`), {});
    list.forEach((file)=>{
        const size = (fs.statSync(file).size/1024).toFixed(0);
        if( size > 25 ){
            // Editor.log(path.relative(cwd, file)+' = '+size+'kb');
            removePathList.push(path.relative(cwd, file));
        }
    });

    remotePath = fs.readJsonSync(package).cdnPath

    Editor.log(`remotePath=${remotePath}`);
    if (!remotePath || !remotePath.length) {
        Editor.error('package.json缺少cdnPath字段');
        return;
    }

    tar.c(
        {
            gzip: true,
            file: tarFile,
            cwd: cwd
        },
        ['./res']
    ).then(() => {
        Editor.log('打包到' + tarFile);
        const options = {
            url: 'http://10.54.238.67:8080/n/cdn/sync',
            headers: {
                'content-type': 'multipart/form-data'
            }
        };
        const r = request.post(options, (err, httpResponse, body) => {
            if (err) {
                Editor.log('上传失败', err);
                return;
            }
            try {
                body = JSON.parse(body);
            }
            catch (err) {
                Editor.log('回包解析错误');
                Editor.log(body);
                return;
            }
            if (0 === body.retcode) {
                Editor.log('上传成功');
                fs.removeSync(tarFile);
                removePathList.forEach((removePath)=>{
                    fs.removeSync( path.resolve(cwd, removePath) );
                });
                // fs.removeSync(resPath);
                Editor.log('包体res目录清理成功!');
                Editor.success('[微信小游戏]资源处理到cdn完毕!');
                computePackageSize(buildPath);
                return;
            }
            else {
                Editor.log('上传失败', `${body.data.msg}(${body.retcode})`);
                return;
            }
        });
        const from = r.form();
        from.append('remote_path', remotePath);
        from.append('data', fs.createReadStream(tarFile));
    })
        .catch((err) => {
            if (fs.existsSync(resPath)) {
                Editor.log('打包失败!', err);
            }
            else {
                Editor.log(`打包失败!目录不存在${resPath}!`);
                Editor.log('请先构建微信小游戏!');
            }
        })
}