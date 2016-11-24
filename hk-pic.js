var Promise = require('bluebird');
var superagent = require('superagent');
var cheerio = require('cheerio');
var fs = require('fs');
var mkdirp = require('mkdirp');
var imageRoot = './images/hk-pic';
const HOST = '198.24.143.234/';
const TIME_OUT = 500;
const USER_INFO = {
    username: 'hackcsfy',
    password: '15196634454'
};

var baseHeader = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/49.0.2623.87 Safari/537.36'
};
start();
function start() {
    login(HOST+'member.php?mod=logging&action=login&loginsubmit=yes&infloat=yes&lssubmit=yes')
        /*.then(function () {
            console.log('登录成功')
            return getAsync(HOST+'forum-18-1.html');
        })
        .then(function (result) {
            var urls = parseMainPage(result.text);
            console.log('start: 一共有%j页',urls.length);
            return Promise.mapSeries(urls,function (url, index) {
                console.log('start: 正在抓取第%j页',index+1);
                return getGroupPageInfo(HOST+url);
            },{concurrency:1});
        })*/
        .catch(function (err) {
            console.log('start: %j',err.message)
            
        });
}
function login(url) {
    return postAsync(url)
        .then(function (result) {
            console.log('login: %j',result.statusCode);
            var cookie = result.header['set-cookie'].join(';');
            baseHeader['Cookie'] = cookie;
        })
        /*.catch(function (err) {
            console.log('login: %j',err.message)
            //throw new Error('登录失败！');
        })*/
}
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
    $('.tip_c a').each(function () {
        urls.push($(this).attr('href'));
    });
    groupNum++;
    return {urls: urls, dirName:dirName};
    
}
function getGroupPageInfo(url) {
    return getAsync(url)
        .then(function (result) {
            console.log('getGroupPageInfo: 拉取页面成功');
            var urls = getGroupPageUrls(result.text);
            console.log('getGroupPageInfo: 一共有%j组图片需要拉取',urls.length);
            return Promise.mapSeries(urls, function (url, index) {
                console.log('getGroupPageInfo: 正在拉取第%j组图片的页面',index+1);
                return getGroupImageInfo(HOST+url,index);
            }) 
        })
        .then(function (result) {
            console.log(result);
        })
        .catch(function (err) {
            console.log('getGroupPageInfo: 拉取页面失败');
            console.log(err.message);
            
        })
}
var groupNum = 1001;
function getGroupImageInfo(url,index) {
    
    return getAsync(url)
        .then(function (result) {
            console.log('getGroupImageInfo: 拉取页面成功');
            var obj = getGroupImageUrls(result.text);
            console.log('getGroupImageInfo: 一共有%j张图片需要下载',obj.urls.length);
            mkdirp(obj.dirName);
            
            return Promise.mapSeries(obj.urls, function (url,index) {
                console.log('getGroupImageInfo: 正在下载第%j张图片',index+1);
                return downloadImage(HOST+url,obj.dirName,index+'.jpg')
            })
        })
        .then(function (result) {
            console.log(result);
        })
        .catch(function (err) {
            console.log(err);
        })
}
function downloadImage(url, targetDir, fileName) {
    return getAsync(url)
        .then(function(result) {
            console.log('downloadImage: 下载图片%j成功',fileName)
            fs.writeFile(targetDir+'/'+fileName,result.body);
            return 'sucess';
        })
        .catch(function(err) {
            console.log('下载图片 %j 失败：%j',url,err.message);
            return 'failed'
        })
}
function getAsync(url) {
    return new Promise(function (resolve, reject) {
       superagent.get(url)
           .timeout(TIME_OUT)
           .set(baseHeader)
           .end(function (err, res) {
               if(err) {
                   console.log('getAsync: %j',err.message)
                   reject(err);
               }else {
                   resolve(res);
                   
               }
               
           })
    });
}
function postAsync(url) {
    return new Promise(function (resolve, reject) {
        superagent.post(url)
            .timeout(TIME_OUT)
            .set(baseHeader)
            .type('form')
            .send(USER_INFO)
            .on('error',function (err) {
                console.log(err.message)
            })
            .end(function (err, res) {
                console.log('ss')
                if(err) {
                    console.log('postAsync:%j',err);
                    reject(err);
                }else {
                    console.log('ss')
                    resolve(res);
                    console.log(res.statusCode)
                }
            })
    })
}