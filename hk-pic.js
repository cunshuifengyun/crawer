var Promise = require('bluebird');
var superagent = require('superagent');
var cheerio = require('cheerio');
var fs = require('fs');
var mkdirp = require('mkdirp');
var imageRoot = './images/hk-pic';
const HOST = '/';
const TIME_OUT = 20000;
const USER_INFO = {
    username: '',
    password: ''
};

var baseHeader = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/49.0.2623.87 Safari/537.36'
};
start();
function start() {
    login(HOST+'member.php?mod=logging&action=login&loginsubmit=yes&infloat=yes&lssubmit=yes')
        .then(function (cookie) {
            return getAsync(HOST+'forum-18-1.html',cookie);
        })
        .then(function (result) {
            var $ = cheerio.load(result.text);
            var page = $('#fd_page_bottom a.last').attr('href').replace('.html','').split('-')[2];
            console.log('一共有%j页',page);
            var urls = [];
            for(var i=1; i<=page; i++) {
                urls.push('forum-18-'+i+'.html');
            }
            return Promise.mapSeries(urls.slice(1,2),function (url, index) {
                return getGroupPageInfo(HOST+url);
            },{concurrency:1});
        })
        .catch(function (err) {
            console.log(err.message)
        })
}
function login(url) {
    return postAsync(url)
        .then(function (result) {
            var cookie = result.header['set-cookie'].join(';');
            baseHeader['Cookie'] = cookie;
            return cookie;
        })
        .catch(function (err) {
            console.log(err.message);
        })
}
function getMainPageInfo() {
    
}
function parse() {
    
}
function getGroupPageInfo(url,cookie) {
    return getAsync(url)
        .then(function (result) {
            var $ = cheerio.load(result.text);
            var urls = [];
            $('#moderate ul li a.z').each(function () {
                var href = $(this).attr('href');
                urls.push(href);
            });
            return Promise.mapSeries(urls, function (url, index) {
                return getGroupImageInfo(HOST+url,index);
            }) 
        })
        .then(function (result) {
            console.log('ss')
        })
        .catch(function (err) {
            console.log(err.message);
        })
}
var groupNum = 1001;
function getGroupImageInfo(url,index) {
    
    return getAsync(url)
        .then(function (result) {
            var $ = cheerio.load(result.text);
            var urls = [];
            var title = $('#thread_subject').text().replace(/[\/\\\|\<\>\*\:\?\"]/,'_');
            var dirName = imageRoot+'/'+groupNum+'--'+title;
            groupNum++;

            mkdirp(dirName);
            $('.tip_c a').each(function () {

                urls.push($(this).attr('href'));
            })
            return Promise.mapSeries(urls, function (url,index) {
                return downloadImage(HOST+url,dirName,index+'.jpg')
            },{concurrency: 5})
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
            .end(function (err, res) {
                if(err) {
                    reject(err);
                }else {
                    resolve(res);
                }
            })
    })
}