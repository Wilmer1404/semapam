(function() {
  if (typeof globalThis === 'undefined') {
    if (typeof self !== 'undefined') { self.globalThis = self; }
    else if (typeof window !== 'undefined') { window.globalThis = window; }
    else if (typeof global !== 'undefined') { global.globalThis = global; }
  }

  if (typeof queueMicrotask === 'undefined') {
    window.queueMicrotask = function(callback) {
      Promise.resolve().then(callback).catch(function(e) {
        setTimeout(function() { throw e; }, 0);
      });
    };
  }

  if (typeof Object.fromEntries === 'undefined') {
    Object.fromEntries = function(entries) {
      var obj = {};
      for (var i = 0; i < entries.length; i++) {
        obj[entries[i][0]] = entries[i][1];
      }
      return obj;
    };
  }

  if (typeof Array.prototype.flat === 'undefined') {
    Array.prototype.flat = function(depth) {
      var d = typeof depth === 'undefined' ? 1 : depth;
      return d < 1 ? this.slice() : this.reduce(function(acc, val) {
        return acc.concat(Array.isArray(val) && d > 0 ? val.flat(d - 1) : val);
      }, []);
    };
  }

  if (typeof String.prototype.matchAll === 'undefined') {
    String.prototype.matchAll = function(regexp) {
      if (!(regexp instanceof RegExp)) throw new TypeError('must be a RegExp');
      if (!regexp.global) throw new TypeError('must have global flag');
      var str = this;
      var matches = [];
      var match;
      while ((match = regexp.exec(str)) !== null) {
        matches.push(match);
        if (match.index === regexp.lastIndex) regexp.lastIndex++;
      }
      return matches;
    };
  }

  if (typeof String.prototype.trimEnd === 'undefined') {
    String.prototype.trimEnd = function() {
      return this.replace(/[\s\uFEFF\xA0]+$/, '');
    };
  }

  if (typeof String.prototype.trimStart === 'undefined') {
    String.prototype.trimStart = function() {
      return this.replace(/^[\s\uFEFF\xA0]+/, '');
    };
  }
})();
