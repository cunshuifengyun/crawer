function test(c,d) {
    var a = [c,d]
    return a;
}
var aa = test(1,2);
var bb = test(3,4);
console.log(aa);
console.log(bb);
aa.shift();
console.log(aa);
console.log(bb)