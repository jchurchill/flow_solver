// depends: lazy.js
var HashSet = function(elems) {
	var that = this;
	this._hashBuckets = {};
	Lazy(elems).each(function(el) {
		that.add(el);
	});
};


// "Private" methods
HashSet.prototype._hash = function(element) {
	// "primitive" hashable types
	if (typeof(element) === "number" || typeof(element) === "string" || typeof(element) === "boolean") {
		return { code: element.toString(), equalsFunc: function(other) { return other === element; } };
	}
	// object not hashable unless hashcode and equals provided
	else if (typeof(element) === "object") {
		if (typeof(element.hashCode) === "function" && typeof(element.equals) === "function") {
			return { code: element.hashCode(), equalsFunc: element.equals.bind(element) };
		}
		throw "HashSet element '" + element + "' must implement hashCode and equals";
	}
	else {
		throw "HashSet element '" + element + "' not valid as an element in a set";
	}
};


// "Public" methods
HashSet.prototype.contains = function(element) {
	var hashed = this._hash(element);
	return this._hashBuckets.hasOwnProperty(hashed.code) 
		&& Lazy(this._hashBuckets[hashed.code]).some(function(e) { return hashed.equalsFunc(e); });
};

HashSet.prototype.add = function(element) {
	var exists = this.contains(element);

	if (exists) { return false; }

	var hashed = this._hash(element);
	if (!this._hashBuckets.hasOwnProperty(hashed.code)) {
		this._hashBuckets[hashed.code] = [];
	}
	this._hashBuckets[hashed.code].push(element);
	return true;
};

HashSet.prototype.remove = function(element) {
	var exists = this.contains(element);
	if (!exists) { return false; }

	var hashed = this._hash(element),
		hashBucket = this._hashBuckets[hashed.code],
		bucketSize = hashBucket.length;
	if (bucketSize === 1) {
		delete this._hashBuckets[hashed.code];
		return true;
	}
	for (var i = bucketSize; i >= 0; i--) {
		if (hashed.equalsFunc(hashBucket[i])) {
			this._hashBuckets[hashed.code] = hashBucket.slice(0,i).concat(hashBucket.slice(i+1,bucketSize));
			return true; 
		}
	};
};

HashSet.prototype.size = function() {
	return Lazy(this._hashBuckets).sum('length');
};

HashSet.prototype.enumerate = function(element) {
	return Lazy(this._hashBuckets).flatten();
};