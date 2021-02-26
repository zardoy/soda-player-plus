// try to avoid error logs. doesn't really matter
window.ga = () => { }; ga.l = +new Date;

const consoleLogOld = console.log.bind(console);
console.log = (...args) => {
    // parse logs here

    consoleLogOld(...args)
}
