module.exports = () => {
    var x = classnames({
        "abc": true,
        "def": c1,
        "ghi": !c1
    }), c1, c2;
    if(c1) {
        x = "def"
    } else {
        x = "ghi"
    }
    return <span className={x} />
}