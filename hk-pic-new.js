/**
 * Created by dell6 on 2016/11/25.
 */
var fetch = require('node-fetch');
var cheerio = require('cheerio');
var Promise = require('bluebird');
var FormData = require('form-data');
var fs = require('fs')
var form = new FormData();
var mkdirp = require('mkdirp');
form.append('username', '');
form.append('password', '');
const HOST = '';
var imageRoot = './images/hk-pic-new';
var groupNum = 1001;
var opts = {
    headers: {}
}
fetch(HOST+'member.php?mod=logging&action=login&loginsubmit=yes&infloat=yes&lssubmit=yes',{method: 'POST', body: form})
    .then(function (res) {
        var cookie = res.headers.getAll('set-cookie');
        opts.headers['cookie'] = cookie.join(';');
        return fetch(HOST+'forum-18-1.html',opts);
    })
    .then(function (res) {
        return res.text();
    })
    .then(function (body) {
        var urls = parseMainPage(body);
        console.log('start: 一共有%j页',urls.length);
        return Promise.mapSeries(urls,function (url, index) {
            console.log('start: 正在抓取第%j页',index+1);

            return fetch(HOST+url,opts)
                .then(function (res) {
                    return res.text();
                })
                .then(function (body) {
                    
                    console.log('getGroupPageInfo: 拉取页面成功');
                    var urls = getGroupPageUrls(body);

                    console.log('getGroupPageInfo: 一共有%j组图片需要拉取',urls.length);
                    return Promise.map(urls, function (url, index) {
                        console.log('getGroupPageInfo: 正在拉取第%j组图片的页面',index+1);
                        
                        return fetch(HOST+url,opts)
                            .then(function (res) {
                                return res.text();
                            })
                            .then(function (body) {
                                console.log('getGroupImageInfo: 拉取页面成功');
                                var obj = getGroupImageUrls(body);
                                console.log('getGroupImageInfo: 一共有%j张图片需要下载',obj.urls.length);
                                mkdirp(obj.dirName);
                                return Promise.map(obj.urls, function (url,index) {
                                    console.log('getGroupImageInfo: 正在下载第%j张图片',index+1);
                                    return downloadImage(url,obj.dirName,index+'.jpg')
                                },{concurrency:1})
                            })
                    },{concurrency: 1})
                });
        },{concurrency:1});
    })
    .catch(function (err) {
        console.log(err);
    })
function parseMainPage(body) {
    var $ = cheerio.load(body);
    var page = $('#fd_page_bottom a.last').attr('href').replace('.html','').split('-')[2];
    var urls = [];
    for(var i=1; i<=page; i++) {
        urls.push('forum-18-'+i+'.html');
    }
    return urls;
}
function getGroupPageUrls(body) {
    var $ = cheerio.load(body);
    var urls = [];
    $('#moderate ul li a.z').each(function () {
        var href = $(this).attr('href');
        urls.push(href);
    });
    return urls;
}
function getGroupImageUrls(body) {
    var $ = cheerio.load(body);
    var urls = [];
    var title = $('#thread_subject').text().replace(/[\/\\\|\<\>\*\:\?\"]/,'_');
    var dirName = imageRoot+'/'+groupNum+'--'+title;
    $('#postlist .t_f img').each(function () {
        var src = $(this).attr('zoomfile')||$(this).attr('file');
        urls.push(src);
    });
    groupNum++;
    return {urls: urls, dirName:dirName};

}
function downloadImage(url, targetDir, fileName) {
    return fetch(url,opts)
        .then(function(res) {


            //var dest = fs.createWriteStream(targetDir+'/'+fileName);
            return res.buffer();
            

        })
        .then(function (buffer) {
            console.log('downloadImage: 下载图片%j成功',fileName)
            fs.writeFile(targetDir+'/'+fileName,buffer);
            return 'sucess';
        })
        .catch(function(err) {
            console.log('下载图片 %j 失败：%j',url,err.message);
            return 'failed'
        })
}

