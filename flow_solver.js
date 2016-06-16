// depends: lazy.js
// depends: HashSet2.js
// depends: d3
var Flow = {};

/****************************/
/*      Node (Graph)        */
/****************************/

Flow.Node = {};
Flow.Node.new = function(id) {
	var color = null,
		adjacentNodes = new HashSet();

	var node = {
		addNeighbor: function(neighbor) {
			if (neighbor === null) { throw "Argument must not be null: neighbor"; }
			adjacentNodes.add(neighbor);
		},
		neighbors: function() {
			return adjacentNodes.enumerate();
		},
		isClaimed: function() {
			return color !== null;
		},
		claim: function(claimColor, callback) {
			if (color !== null) { throw "Cannot claim an already-claimed node"; }
			color = claimColor;
			if (typeof callback === 'function') {
				callback(id);
			}
		},
		unclaim: function(callback) {
			if (color === null) { throw "Cannot unclaim an already-unclaimed node"; }
			color = null;
			if (typeof callback === 'function') {
				callback(id);
			}
		},
		color: function() {
			return color;
		},
		getId: function() {
			return id;
		},
		hashCode: function() {
			return id;
		},
		equals: function(other) {
			return other === this;
		}
	};

	return node;
};


Flow.Grid = {};

/****************************/
/*     Square Grid View     */
/****************************/
Flow.Grid.View = {
	getBoard: function() { return d3.select("#flow-grid"); },
	color: function(color, continueWith) {
		return this._applyColorFunc(color, continueWith);
	},
	uncolor: function(continueWith) {
		return this._applyColorFunc(this.emptyColor, continueWith);
	},
	_applyColorFunc: function(color, continueWith) {
		var that = this;
		return function(id) {
			d3.select("#" + that.getNodeId(id))
				.transition()
				.duration(30)
				.style("background-color", color)
				.call(that.endall, continueWith || function() {});
		};
	},
	emptyColor: "white",
	nodeClass: "flow-node",
	getNodeId: function(id){
		return "gridnode" + id;
	},
	// D3 helper method
	endall: function(transition, callback) { 
		var n = 0; 
		transition 
			.each(function() { ++n; }) 
			.each("end", function() { if (!--n) callback.apply(this, arguments); }); 
	}
};

/****************************/
/*      Grid (Graph)        */
/****************************/

// n is the side-length of the square grid
Flow.Grid.new = function(n) {
	// We'll represent the grid as an array;
	// 0 - (n-1) are the first row, n - (2n-1) are the second row, and so on.
	var graph = Lazy.range(n*n).map(function(i) { return Flow.Node.new(i); }).toArray();
	var getNode = function(r,c) { return graph[r*n + c]; };

	var gridView = Flow.Grid.View.getBoard(), gridViewRow, gridViewNode;
	gridView.selectAll("*").remove();

	// Hook up each node with edges to its adjacent neighbors on the grid
	for (var r = 0; r < n; r++) {
		gridViewRow = gridView.append('tr');
		for (var c = 0; c < n; c++) {
			var node = getNode(r,c);

			// View operations
			gridViewRow.append('td')
				.attr("id", Flow.Grid.View.getNodeId(node.getId()))
				.attr("class", Flow.Grid.View.nodeClass)
				.attr("data-row", r)
				.attr("data-col", c)
				.style('background-color', Flow.Grid.View.emptyColor)
				.append('div').html("&nbsp");

			// Begin with directions (up, left, down, right)
			Lazy([[-1,0],[0,-1],[1,0],[0,1]])
				// Map each direction to the coordinate of the node (from this node)
				.map(function(p) { return { r: p[0]+r, c: p[1]+c }; })
				// Remove any coordinates that wouldn't exist in the grid (e.g., past an edge)
				.reject(function(p) { return p.r < 0 || p.r >= n || p.c < 0 || p.c >= n; })
				// Map each coordinate to the actual node
				.map(function(p) { return getNode(p.r, p.c); })
				// Add each of these as a neighbor of this node
				.each(function(nd) { node.addNeighbor(nd); });
		}
	};

	// private vars to the grid
	var ready = false;
	var endpoints = [];
	var epset;

	var grid = {
		grid: graph,
		isReady: function() {
			return ready;
		},
		getNode: function(r,c) {
			return getNode(r,c);
		},
		// Looks like:
		//	endpoints: {
		//		color: string
		//		start: Node
		//		end: Node
		//	}
		getEndpoints: function() {
			return endpoints;
		},
		finalize: function() {
			// Generate internal endpoint pair list
			endpoints = Lazy(graph)
				.filter(function(n) { return n.isClaimed(); })
				.groupBy(function(n) { return n.color(); })
				.map(function(p, color) {
					return { color: color, start: p[0], end: p[1] };
				})
				.toArray();

			// Generate internal endpoint hashset
			epset = new HashSet(Lazy(endpoints).map(function(ep) { return [ep.start, ep.end]; }).flatten());
			ready = true;
		},
		applyPath: function(color, pathNodes, continueWith) {
			var path = Lazy(pathNodes).filter(function(n) { return n.color() !== color; }),
				p_i = 0,
				color_complete = function() {
					p_i--;
					if (p_i === 0) {
						continueWith();
					}
				};

			path.each(function(n) {
				p_i++;
			});

			path.each(function(n) {
				n.claim(color, Flow.Grid.View.color(color, color_complete));
			});
		},
		removePath: function(pathNodes, continueWith) {
			var path = Lazy(pathNodes).filter(function(n) { return !epset.contains(n); }),
				p_i = 0,
				color_complete = function() {
					p_i--;
					if (p_i === 0) {
						continueWith();
					}
				};

			path.each(function(n) {
				p_i++;
			});

			path.each(function(n) {
				n.unclaim(Flow.Grid.View.uncolor(color_complete));
			});
		},
		enumerateValidPaths: function(s, t) {
			// Below: an iterative (using a queue) BFS
			var queue = [{ prev: null, head: s, path: new HashSet([s]) }],
				current, head, path,
				wrapsBackToPath = function(prev, next, path) {
					return Lazy(next.neighbors()).some(function(n) { return n !== prev && path.contains(n); });
				};

			return Lazy.generate(function() {
				while (queue.length > 0) {
					current = queue.shift();
					prev = current.prev;
					head = current.head;
					path = current.path;
					// If this path has found its way to the end, yield it
					if (head === t) {
						return path;
					}
					// If it hasn't, keep searching
					else {
						// For each neighbor of the current head, add to the BFS queue to
						// explore iff it satisfies all of the following conditions for validity:
						// - It is an unclaimed node
						// - It is not the node we came from
						// - It does not "wrap around" on itself
						// 		(i.e., does not have an adjacent node in the current path other than the one we came from)
						head.neighbors()
							.reject(function(n) {
								return (n !== t && n.isClaimed())
									|| (n === prev)
									|| wrapsBackToPath(head, n, path);
							})
							.each(function(next) {
								var nextPath = new HashSet(path.enumerate());
								nextPath.add(next);
								queue.push({ prev: head, head: next, path: nextPath });
							});
					}
				}
				// If the queue is empty, there is nothing left to yield; return null to indicate this
				return null;
			});
		},
		toString: function() {
			return Lazy.range(n).map(function(r) {
				return Lazy.range(n).map(function(c) {
					var node = getNode(r,c);
					return node.color() || ".";
				}).join(" ");
			}).join("\n");
		}
	};

	return grid;
};



/****************************/
/*         Solver           */
/****************************/

Flow.Solver = {};
Flow.Solver.Solve = function(grid, completedCallback) {
	if (!grid.isReady()) {
		throw "Grid not in a valid state to begin solving."
	}

	console.time("FlowSolver.Solve");

	// Recursion: given a state of the board (implicit; we'll just update the state of a single board that we reference) 
	// and some set of colors to select a path for, return true if a solution has been found that connects those colors
	// (and the current state of the board reflects that solution)
	var recursiveSolve = function recSolve(colorEndpoints, completedCallback) {
		var asyncComplete = completedCallback || function() {};

		// Base case: colors is empty. We're done!
		if (colorEndpoints.size() === 0) {
			asyncComplete(true);
			return;
		}

		// Base case 2: there is some endpoint pair that has no possible paths connecting it. No solution!
		// This is a pretty cheap check since we don't actually enumerate all valid paths here, we only
		// need to see that at least one exists for each pair of endpoints
		// (and the lazy enumerator takes care of that for us)
		var hasAtLeastOnePath = function(ep) {
			return grid.enumerateValidPaths(ep.start, ep.end).first() !== null;
		};
		if (!colorEndpoints.all(hasAtLeastOnePath)) {
			asyncComplete(false);
			return;
		}

		// Recursive case:
		// Look for all valid paths for the next color
		var color = colorEndpoints.first(),
			remainingColors = colorEndpoints.rest(1),
			validPaths = grid.enumerateValidPaths(color.start, color.end),
			validPathIterator = validPaths.getIterator(),
			// Apply each path to the board and recursively solve the subproblem
			// If it didn't have a solution, revert the application of the path
			tryNextPath = function() {
				var path, pathNodes, recursivelySolveOrRevert, recursiveSolveComplete;
				if (!validPathIterator.moveNext() || validPathIterator.current() === null) {
					asyncComplete(false);
					return;
				}
				path = validPathIterator.current();
				pathNodes = path.enumerate();
				recursiveSolveComplete = function(isSolved) {
					if (!isSolved) {
						grid.removePath(pathNodes, tryNextPath);
					}
					else {
						asyncComplete(true);
					}
				};
				recursivelySolveOrRevert = function() {
					recursiveSolve(remainingColors, recursiveSolveComplete);
				};
				
				grid.applyPath(color.color, pathNodes, recursivelySolveOrRevert);
			};
		tryNextPath();
	};

	recursiveSolve(
		Lazy(grid.getEndpoints()),
		function(isSolved) {
			console.timeEnd("FlowSolver.Solve");
			completedCallback(isSolved);
		});
};
Flow.SolveProblem = function(i) {
	var problem = Flow.Problems[i]();
	console.log(problem.toString());
	Flow.Solver.Solve(problem, function(solved) {
		console.log(solved ? "Solved!" : "Has no solution.")
		console.log(problem.toString());
	});
};

/*****************************/
/* Test problems (debugging) */
/*****************************/

Flow.Test = {};
Flow.Test.ParseProblem = function(gridString) {
	var rows = gridString.trim().replace(/ /g, '').split("\n");
	var rowLen = null;
	var points = {};
	Lazy(rows).each(function(row, r) {
		if (rowLen !== null && row.length !== rowLen) {
			throw "Expected grid to have uniform row lengths!";
		}
		rowLen = rowLen || row.length;
		Lazy(row)
			.map(function(chr, c) { return { chr: chr, r: r, c: c }; })
			.reject(function(loc) { return loc.chr === "."; })
			.each(function(loc) {
				points[loc.chr] = points[loc.chr] || [];
				points[loc.chr].push({ r: loc.r, c: loc.c });
			});
	});

	if (Lazy(points).size() === 0) {
		throw "Expected at least one pair of points to solve!";
	}
	if (Lazy(points).some(function(val) { return val.length !== 2 })) {
		throw "Expected pairs of two on the grid!";
	}
	if (rowLen !== rows.length) {
		throw "Only square grids are currently supported."
	}

	var grid = Flow.Grid.new(rowLen);
	// Add each endpoint pair to the board
	Lazy(points).each(function(pair, chr) {
		var color = Flow.Test.ColorMap[chr];
		grid.getNode(pair[0].r, pair[0].c).claim(color);
		grid.getNode(pair[1].r, pair[1].c).claim(color);
	});
	grid.finalize();
	return grid;
}

Flow.Test.ColorMap = {
	"A" : "red",
	"B" : "blue",
	"C" : "green",
	"D" : "pink",
	"E" : "purple",
	"F" : "gold",
	"G" : "aqua",
	"H" : "orange",
	"I" : "magenta",
	"J" : "indigo",
};

Flow.Test.Problems = [];
Flow.Test.Problems[0] = function() {
	var board = 
		" A . . . . \n" +
		" C . . . . \n" +
		" . . B . . \n" +
		" . . C . . \n" +
		" . . B . A \n";

	return Flow.Test.ParseProblem(board);
};
Flow.Test.Problems[1] = function() {
	var board = 
		" . . A . . . \n" +
		" . B C . D . \n" +
		" A . . . . C \n" +
		" . . . . . . \n" +
		" D E . . B . \n" +
		" E . . . . . \n";

	return Flow.Test.ParseProblem(board);
};
Flow.Test.Problems[2] = function() {
	var board = 
		" A . . . . . . E \n" +
		" . . . . . . . . \n" +
		" . . . B . C . . \n" +
		" . . . . . . D E \n" +
		" . . . . C . . . \n" +
		" . . D . . . A . \n" +
		" B . . . F . F . \n" +
		" . . . . . . . . \n";

	return Flow.Test.ParseProblem(board);
};
Flow.Test.Problems[3] = function() {
	var board = 
		" A C B . D F . . . \n" +
		" . . . . . E . . . \n" +
		" . B C . . . D E . \n" +
		" A . . . . . . . . \n" +
		" . . . . . G . J . \n" +
		" . J . . H . . . . \n" +
		" . . . . . . F G . \n" +
		" . . . I . . . . . \n" +
		" I . . . . . . . H \n";

	return Flow.Test.ParseProblem(board);
};
Flow.Test.Problems[4] = function() {
	var board = 
		" A . . . . . . . . B \n" +
		" . . . . . . . . . . \n" +
		" . . . . . . . . . . \n" +
		" . . . . . . . . . . \n" +
		" C C D D E E F F G G \n" +
		" . . . . . . . . . . \n" +
		" . . . . . . . . . . \n" +
		" . . . . . . . . . . \n" +
		" . . . . . . . . . . \n" +
		" B . . . . . . . . A \n";

	return Flow.Test.ParseProblem(board);
};
Flow.Test.Problems[5] = function() {
	var board = 
		" . . . . . . . . B \n" +
		" . A . A . . F . . \n" +
		" . . . C . . . . B \n" +
		" E F . . . . G . G \n" +
		" . . . . . . . . H \n" +
		" . . . . . . . . I \n" +
		" . . . . . . . . C \n" +
		" . . H I . . . . . \n" +
		" E . . . . D . . D \n";

	return Flow.Test.ParseProblem(board);
};
Flow.Test.Problems[6] = function() {
	var board = 
		" . . . . . . . . . \n" +
		" A . B . C . D E . \n" +
		" . . G . . . . . . \n" +
		" . . . . . E . F . \n" +
		" . . . . D . . . A \n" +
		" . . . . . . H G . \n" +
		" . . . . H . . F . \n" +
		" . . C . . . . . . \n" +
		" B . . . . . . . . \n";

	return Flow.Test.ParseProblem(board);
};
Flow.Test.Problems[7] = function() {
	var board = 
		" . . . . . . . . B \n" +
		" . H . . . . . A I \n" +
		" . . C . . . . I . \n" +
		" A D G H C . . . . \n" +
		" . . . . B . E F . \n" +
		" . . . . . G . . . \n" +
		" . F . . D E . . . \n" +
		" . . . . . . . . . \n" +
		" . . . . . . . . . \n";

	return Flow.Test.ParseProblem(board);
};