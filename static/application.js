/* global $, hljs, window, document */
// taken from the haste-server project

///// represents a single document

var haste_document = function() {
  this.locked = false;
};

// Escapes HTML tag characters
haste_document.prototype.htmlEscape = function(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/>/g, '&gt;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
};

// Get this document from the server and lock it here
haste_document.prototype.load = function(key, callback, lang) {
  var _this = this;
  var request = new XMLHttpRequest();
  request.open('GET', '/documents/' + key, true);

  request.onreadystatechange = function() {
    if (this.readyState === 4) {
      if (this.status >= 200 && this.status < 400) {
        var res = JSON.parse(this.response);
        _this.locked = true;
        _this.key = key;
        _this.data = res.data;
        try {
          var high;
          if (lang === 'txt') {
            high = { value: _this.htmlEscape(res.data) };
          }
          else if (lang) {
            high = hljs.highlight(lang, res.data);
          }
          else {
            high = hljs.highlightAuto(res.data);
          }
        } catch(err) {
          // failed highlight, fall back on auto
          high = hljs.highlightAuto(res.data);
        }
        callback({
          value: high.value,
          key: key,
          language: high.language || lang,
          lineCount: res.data.split('\n').length
        });
      } else {
        callback(false);
      }
    }
  }
  request.send();
  request = null;
};

// Save this document to the server and lock it here
haste_document.prototype.save = function(data, callback) {
  if (this.locked) {
    return false;
  }
  this.data = data;
  var _this = this;
  var request = new XMLHttpRequest();
  request.open('POST', '/documents', true);
  request.setRequestHeader('Content-Type', 'application/json; charset=utf-8');
  request.send(data);

  request.onreadystatechange = function() {
    if (this.readyState === 4) {
      if (this.status >= 200 && this.status < 400) {
        var res = JSON.parse(this.response);
        _this.locked = true;
        _this.key = res.key;
        var high = hljs.highlightAuto(data);
        callback(null, {
          value: high.value,
          key: res.key,
          language: high.language,
          lineCount: data.split('\n').length
        });
      } else {
        try {
          callback(JSON.parse(this.responseText));
        }
        catch (e) {
          callback({message: 'Something went wrong!'});
        }
      }
    }
  }
};

///// represents the paste application

var haste = function(appName, options) {
  this.appName = appName;
  this.textarea = document.getElementsByTagName('textarea')[0];
  this.box = document.getElementById('box');
  this.code = document.getElementById('box').getElementsByTagName('code')[0];
  this.linenos = document.getElementById('linenos'); // this is never used?
  this.options = options;
  this.configureShortcuts();
  this.configureButtons();
  this.setupTabHandling();
  // If twitter is disabled, hide the button
  if (!options.twitter) {
    document.getElementById('box2').getElementsByClassName('twitter')[0].style.display = 'none';
  }
};

// Set the page title - include the appName
haste.prototype.setTitle = function(ext) {
  var title = ext ? this.appName + ' - ' + ext : this.appName;
  document.title = title;
};

// Show a message box
haste.prototype.showMessage = function(msg, cls) {
  var msgArea = document.getElementById('messages');
  msgArea.insertAdjacentHTML('afterbegin', '<li class="'+(cls || 'info')+'">'+msg+'</li>');
  setTimeout(function() {
    /* maybe this could be also done prettier similar to slideup of jQuery */
    msgArea.firstElementChild.remove()
  }, 3000);
};

// Show the light key
haste.prototype.lightKey = function() {
  this.configureKey(['new', 'save']);
};

// Show the full key
haste.prototype.fullKey = function() {
  this.configureKey(['new', 'duplicate', 'twitter', 'raw']);
};

/* Compare passed class array "enable" against buttons. If the class names 
 * are matching, enable the button, otherwise disable it. */
haste.prototype.configureKey = function(enable) {
  var elements = document.querySelectorAll('#box2 .function');
  Array.prototype.forEach.call(elements, function(el) {
    for (var i = 0; i < enable.length; i++) {
      if (el.classList.contains(enable[i])) {
        el.classList.add('enabled');
        return true;
      }
    }
    el.classList.remove('enabled');
  });
};

// Remove the current document (if there is one)
// and set up for a new one
haste.prototype.newDocument = function(hideHistory) {
  this.box.style.display = 'none';
  this.doc = new haste_document();
  if (!hideHistory) {
    window.history.pushState(null, this.appName, '/');
  }
  this.setTitle();
  this.lightKey();
  this.textarea.value = '';
  this.textarea.style.display = 'inline-block';
  this.textarea.focus();
  // focus textarea after 200 ms?!
  this.removeLineNumbers();
};

// Map of common extensions
// Note: this list does not need to include anything that IS its extension,
// due to the behavior of lookupTypeByExtension and lookupExtensionByType
// Note: optimized for lookupTypeByExtension
haste.extensionMap = {
  rb: 'ruby', py: 'python', pl: 'perl', php: 'php', scala: 'scala', go: 'go',
  xml: 'xml', html: 'xml', htm: 'xml', css: 'css', js: 'javascript', vbs: 'vbscript',
  lua: 'lua', pas: 'delphi', java: 'java', cpp: 'cpp', cc: 'cpp', m: 'objectivec',
  vala: 'vala', sql: 'sql', sm: 'smalltalk', lisp: 'lisp', ini: 'ini',
  diff: 'diff', bash: 'bash', sh: 'bash', tex: 'tex', erl: 'erlang', hs: 'haskell',
  md: 'markdown', txt: '', coffee: 'coffee', json: 'javascript',
  swift: 'swift'
};

// Look up the extension preferred for a type
// If not found, return the type itself - which we'll place as the extension
haste.prototype.lookupExtensionByType = function(type) {
  for (var key in haste.extensionMap) {
    if (haste.extensionMap[key] === type) return key;
  }
  return type;
};

// Look up the type for a given extension
// If not found, return the extension - which we'll attempt to use as the type
haste.prototype.lookupTypeByExtension = function(ext) {
  return haste.extensionMap[ext] || ext;
};

// Add line numbers to the document
// For the specified number of lines
haste.prototype.addLineNumbers = function(lineCount) {
  var h = '';
  for (var i = 0; i < lineCount; i++) {
    h += (i + 1).toString() + '<br/>';
  }
  document.getElementById('linenos').innerHTML = h;
};

// Remove the line numbers
haste.prototype.removeLineNumbers = function() {
  document.getElementById('linenos').innerHTML = '&gt;';
};

// Load a document and show it
haste.prototype.loadDocument = function(key) {
  // Split the key up
  var parts = key.split('.', 2);
  // Ask for what we want
  var _this = this;
  _this.doc = new haste_document();
  _this.doc.load(parts[0], function(ret) {
    if (ret) {
      _this.code.innerHTML = ret.value;
      _this.setTitle(ret.key);
      _this.fullKey();
      _this.textarea.value = '';
      _this.textarea.style.display = 'none';
      _this.box.style.display = '';
      _this.box.focus();
      _this.addLineNumbers(ret.lineCount);
    }
    else {
      _this.newDocument();
    }
  }, this.lookupTypeByExtension(parts[1]));
};

// Duplicate the current document - only if locked
haste.prototype.duplicateDocument = function() {
  if (this.doc.locked) {
    var currentData = this.doc.data;
    this.newDocument();
    this.textarea.value = currentData;
  }
};

// Lock the current document
haste.prototype.lockDocument = function() {
  var _this = this;
  this.doc.save(this.textarea.value, function(err, ret) {
    if (err) {
      _this.showMessage(err.message, 'error');
    }
    else if (ret) {
      _this.code.innerHTML = ret.value;
      _this.setTitle(ret.key);
      var file = '/' + ret.key;
      if (ret.language) {
        file += '.' + _this.lookupExtensionByType(ret.language);
      }
      window.history.pushState(null, _this.appName + '-' + ret.key, file);
      _this.fullKey();
      _this.textarea.value = '';
      _this.textarea.style.display = 'none';
      _this.box.style.display = '';
      _this.box.focus();
      _this.addLineNumbers(ret.lineCount);
    }
  });
};

haste.prototype.configureButtons = function() {
  var _this = this;
  this.buttons = [
    {
      where: document.getElementById('box2').getElementsByClassName('save')[0],
      label: 'Save',
      shortcutDescription: 'control + s',
      shortcut: function(evt) {
        return evt.ctrlKey && (evt.keyCode === 83);
      },
      action: function() {
        if (_this.textarea.value.replace(/^\s+|\s+$/g, '') !== '') {
          _this.lockDocument();
        }
      }
    },
    {
      where: document.getElementById('box2').getElementsByClassName('new')[0],
      label: 'New',
      shortcut: function(evt) {
        return evt.ctrlKey && evt.keyCode === 78;
      },
      shortcutDescription: 'control + n',
      action: function() {
        _this.newDocument(!_this.doc.key);
      }
    },
    {
      where: document.getElementById('box2').getElementsByClassName('duplicate')[0],
      label: 'Duplicate & Edit',
      shortcut: function(evt) {
        return _this.doc.locked && evt.ctrlKey && evt.keyCode === 68;
      },
      shortcutDescription: 'control + d',
      action: function() {
        _this.duplicateDocument();
      }
    },
    {
      where: document.getElementById('box2').getElementsByClassName('raw')[0],
      label: 'Just Text',
      shortcut: function(evt) {
        return evt.ctrlKey && evt.shiftKey && evt.keyCode === 82;
      },
      shortcutDescription: 'control + shift + r',
      action: function() {
        window.location.href = '/raw/' + _this.doc.key;
      }
    },
    {
      where: document.getElementById('box2').getElementsByClassName('twitter')[0],
      label: 'Twitter',
      shortcut: function(evt) {
        return _this.options.twitter && _this.doc.locked && evt.shiftKey && evt.ctrlKey && evt.keyCode == 84;
      },
      shortcutDescription: 'control + shift + t',
      action: function() {
        window.open('https://twitter.com/share?url=' + encodeURI(window.location.href));
      }
    }
  ];
  for (var i = 0; i < this.buttons.length; i++) {
    this.configureButton(this.buttons[i]);
  }
};

haste.prototype.configureButton = function(options) {
  // Handle the click action
  options.where.onclick = function(evt) {
    evt.preventDefault();

    if (!options.clickDisabled && this.classList.contains('enabled')) {
      options.action();
    }
  };
  // Show the label
  options.where.onmouseenter = function() {
    document.getElementById('box3').getElementsByClassName('label')[0].innerText = options.label;
    document.getElementById('box3').getElementsByClassName('shortcut')[0].innerText = (options.shortcutDescription || '');
    document.getElementById('box3').style.display = 'block';
    this.appendChild(document.getElementById('pointer'));
    document.getElementById('pointer').style.display = '';
  };
  // Hide the label
  options.where.onmouseleave = function() {
    document.getElementById('box3').style.display = 'none';
    document.getElementById('pointer').style.display = 'none';
  };
};

// Configure keyboard shortcuts for the textarea
haste.prototype.configureShortcuts = function() {
  var _this = this;
  document.body.onkeydown = function(evt) {
    var button;
    for (var i = 0 ; i < _this.buttons.length; i++) {
      button = _this.buttons[i];
      if (button.shortcut && button.shortcut(evt)) {
        evt.preventDefault();
        button.action();
        return;
      }
    }
  };
};

///// Tab behavior in the textarea - 2 spaces per tab
haste.prototype.setupTabHandling = function() {
  document.getElementsByTagName('textarea')[0].onkeydown = function(evt) {
    if (evt.keyCode === 9) {
      evt.preventDefault();
      var myValue = '  ';
      // http://stackoverflow.com/questions/946534/insert-text-into-textarea-with-jquery
      // For browsers like Internet Explorer
      if (document.selection) {
        this.focus();
        var sel = document.selection.createRange();
        sel.text = myValue;
        this.focus();
      }
      // Mozilla and Webkit
      else if (this.selectionStart || this.selectionStart == '0') {
        var startPos = this.selectionStart;
        var endPos = this.selectionEnd;
        var scrollTop = this.scrollTop;
        this.value = this.value.substring(0, startPos) + myValue +
          this.value.substring(endPos,this.value.length);
        this.focus();
        this.selectionStart = startPos + myValue.length;
        this.selectionEnd = startPos + myValue.length;
        this.scrollTop = scrollTop;
      }
      else {
        this.value += myValue;
        this.focus();
      }
    }
  };

};

// Construct app and load initial path if present
(function() {
  app = new haste('hastebin', { twitter: true });
  var path = window.location.pathname;
  if (path === '/') {
    app.newDocument(true);
  } else {
    app.loadDocument(path.substring(1, path.length));
  }
})();

