/**
 * Created by Administrator on 2016/11/20.
 */
var Promise = require('bluebird');
var superagent = Promise.promisifyAll(require('superagent'));
var mkdirp = require('mkdirp');
var cheerio = require('cheerio');
var fs = require('fs');
var _ = require('lodash');
var imageRoot = './images';
var ProgressBar = require('progress');

var totalSuccessed = 0;
var totalFailed = 0;
var allPicNum = 0;

start();
function start() {
    console.time('getPageInfo');
    getPageInfo('http://www.mzitu.com')
        .then(function(pageUrls) {
            console.timeEnd('getPageInfo');
            console.time('getImageGroupInfo');
            console.log('一共有%j页',pageUrls.length);
            return Promise.mapSeries(pageUrls, function(url, index) {
                return getImageGroupInfo(url,index);
            },{concurrency: 1})
        })
        .then(function() {
            console.log('Done');
        })
        .catch(function(err) {
            console.timeEnd('getPageInfo');
            console.log(err.message);

        });
}
//superagent.get的promise化
function getAsync(url) {
    return new Promise(function (resolve, reject) {

        var retry = 0
        getUrl(url);
        function getUrl(url) {
            superagent.get(url)
                .timeout(10000)
                .set({
                    'User-Agent': "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:39.0) Gecko/20100101 Firefox/39.0"
                })
                .end(function (err, res) {
                    retry++;

                    if(err) {
                        if(retry!==3) {
                            console.log('这是第%j次尝试',retry);
                            console.log(err.message);
                            setTimeout(function () {
                                getUrl(url);
                            },10000)

                        }else {
                            reject(err);
                        }
                    }else {
                        resolve(res);
                    }
                })
        }
    })
}


//拉取主页，获取主页级页面信息
function getPageInfo(url) {
    return getAsync(url)
        .then(function(result) {
            var $ = cheerio.load(result.text);

            var totalPages = $('a.page-numbers').eq(3).text();
            var urls = [];
            for(var i=1; i<=totalPages; i++) {
                urls.push('http://www.mzitu.com/page/'+i);
            }
            return urls;
        });
}
//拉取主页级页面，获取图组页信息
function getImageGroupInfo(url,index) {
    console.log('开始获取第%j大页',index+1);
    return getAsync(url)
        .then(function(result) {

            console.log('获取第%j大页成功',index+1);
            var $ = cheerio.load(result.text);
            var urls = [];
            $('#pins li span a').each(function () {
                var src = $(this).attr('href')

                urls.push(src);
            });

            return urls;

        })
        .then(function(result) {
            result = _.flatten(result);
            return Promise.mapSeries(result, function(url, index) {

                return getImageShow(url,index);
            },{concurrency: 1})
        })
        .catch(function(err) {
            console.log('获取第%j大页失败，原因是：%j',index+1,err.message);
            return [];
        })

}
var groupNum = 1001;
//拉取图组页面，获取该组图片的展示页面信息
function getImageShow(url,index) {
    var bar;
    console.log('开始获取第%j组照片',index+1);
    return getAsync(url)
        .then(function(result) {

            console.log('获取第%j组照片成功',index+1);
            var $ = cheerio.load(result.text);
            var urls = [];
            var picNum = $('.pagenavi a').last().prev().text();
            var title = $('.main-title').text().replace(/[\/\\\|\<\>\*\:\?\"]/,'_');
            var dirName = imageRoot+'/'+groupNum+'--'+title;
            bar = new ProgressBar('downloading [:bar]:percent :etas',{
                complete: '=',
                incomplete: '',
                width: 20,
                total: Number(picNum)
            });
            groupNum++;
            console.time('group');
            mkdirp(dirName, function (err) {
                if(err) {

                    console.log(err);
                }

            });

            for(var i=0; i<picNum; i++) {
                if(i==0) {
                    urls.push(url);
                }else {
                    urls.push(url+'/'+(i+1));
                }
            }
            return {targetDir:dirName, urls:urls}

        })
        .then(function(result) {

            return Promise.map(result.urls, function(url,index) {
                bar.tick(1);

                return getImageUrl(url, result.targetDir,index);
            },{concurrency: 1})
        })
        .then(function(result) {
            var successed = 0;
            var failed = 0;
            for(var i = 0; i<result.length; i++) {
                if(result[i]=='sucess') {
                    successed++;
                }else if(result[i]=='failed'){
                    failed++;
                }
            }
            allPicNum += result.length;
            totalFailed += failed;
            totalSuccessed += successed;
            console.log('一共有%j张图片需要下载，下载成功%j张,失败%j张',result.length,successed,failed);
            console.log('累积有%j张图片需要下载，下载成功%j张,失败%j张',allPicNum,totalSuccessed,totalFailed);

            console.timeEnd('group');
        })
        .catch(function(err) {
            console.log('获取第%j大页失败，原因是：%j',index+1,err.message);
            return [];
        })
}

//拉取图片展示页面，获取图片src
function getImageUrl(url, targetDir,index) {
    return getAsync(url)
        .then(function(result){

            var $ = cheerio.load(result.text);
            var src = $('.main-image img').attr('src');
            return src;

        })
        .then(function(result) {

            return downloadImage(result,targetDir,index+result.substr(-4,4));
        })
        .then(function(result) {
            return result;
        })
        .catch(function(err) {
            console.log('拉取图片宿主页面 %j 失败：%j',url,err.message);
            return 'failed';
        })
}
//下载图片并保存到本地
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