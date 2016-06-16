// depends: d3
// depends: Lazy
// depends: flow_solver_2.js

// Setup buttons to create a new board
document.addEventListener("DOMContentLoaded", function() {
	var colors,  
		currentGrid,
		gridSize,
		// Editing params
		isEditing,
		allowEdits,
		currentColor,
		unpairedNode, // looks like: {r:int, c:int}
		endpointPairs, // looks like { <color>: [{r:int, c:int}], ... }
		// Solving params
		isSolving;

	d3.selectAll("button.new-board")
		.datum(function() {
			return intAttr(this, "data-sidelen");
		})
		.on("click", function(sidelen) {
			setupNewBoard(sidelen);
		});

	d3.select("button.solve")
		.on("click", function() {
			solve();
		});

	resetAll();
	updateSolveEnabled();

	function resetAll() {
		colors = getInitialColorSet();
		currentGrid = null;
		gridSize = null;
		isEditing = false;
		allowEdits = true;
		currentColor = colors.shift();
		unpairedNode = null; // looks like: {r:int, c:int}
		endpointPairs = {}; // one (k,v) looks like <color>: [{r:int, c:int}]
		isSolving = false;
		d3.select(".solve-msg").html("");
	};

	function getInitialColorSet() {
		// At most we need 14x14/2 = 98 colors to fill a board, so generate 125 (5^3) approx. evenly spaced colors
		var d = 5, hex = 16, r, g, b, colorSet = [];
		var colorHexes = Lazy.range(d)
			.map(function(step) {
				var color = Math.floor(hex*hex*step/(d)).toString(hex);
				return color.length === 1 ? "0" + color : color;
			})
			.toArray();

		for(r in colorHexes) {
			for (g in colorHexes) {
				for (b in colorHexes) {
					colorSet.push("#"+colorHexes[r]+colorHexes[g]+colorHexes[b]);
				}
			}
		}
		return Lazy(colorSet).shuffle().toArray();
	};

	function setupNewBoard(sidelen) {
		var board = Flow.Grid.View.getBoard(); 
		// Not allowed to change board mid-solve
		if (isSolving) {
			return;
		}
		if (isEditing) {
			var canClear = confirm("Okay to clear the current board?");
			if (!canClear) { return; }
		}

		resetAll();
		currentGrid = Flow.Grid.new(sidelen);
		gridSize = sidelen;

		board.classed("editing", true);

		board
			.selectAll("." + Flow.Grid.View.nodeClass)
			.on("click", function() {
				if (allowEdits) {
					handleNodeClick(this);
				}
			});
	};

	function isBoardEmpty() {
		return !(unpairedNode || Lazy(endpointPairs).keys().some()); 
	};

	function updateSolveEnabled() {
		var toggleEnabled = function(enabled) {
			d3.select("button.solve").attr("disabled", enabled ? null : "disabled")
		};
		if (!currentGrid) { toggleEnabled(false); }
		else if (isSolving) { toggleEnabled(false); }
		else if (unpairedNode || isBoardEmpty()) { toggleEnabled(false); }
		else { toggleEnabled(true); }
	}

	function handleNodeClick(node) {
		var row = intAttr(node, "data-row"),
			col = intAttr(node, "data-col"),
			selectedPoint = { r: row, c: col, id: nodeId }, 
			node = currentGrid.getNode(row,col),
			nodeId = node.getId(),
			colorNode = function(color) {
				node.claim(color, function(id) {
					Flow.Grid.View.color(color)(id);
					d3.select("#" + Flow.Grid.View.getNodeId(id))
						.classed("endpoint", true);
				});
			},
			uncolorNode = function() {
				node.unclaim(Flow.Grid.View.uncolor());
			},
			oldPair;

		if (isSolving) {
			return;
		}
		isEditing = true;

		if (unpairedNode) {
			if (node.isClaimed()) {
				// Cannot click on claimed node of different color when specifying second element of pair
				if (node.color() !== currentColor) {
					return;
				}
				// Undo the selection of the first element of the pair
				uncolorNode();
				unpairedNode = null;
			}
			else {
				// Finish the pair
				colorNode(currentColor);
				endpointPairs[currentColor] = [selectedPoint, unpairedNode];
				unpairedNode = null;
				// Setup a new current color for the next pair
				currentColor = colors.shift();
			}
		}
		else {
			// If clicking on claimed node, that node in pair should be undone and becomes the new active pair
			if (node.isClaimed()) {
				currentColor = node.color();
				// clear out old pair
				oldPair = endpointPairs[currentColor];
				delete endpointPairs[currentColor];
				// now, unpaired node is the node from the old pair that wasn't just clicked
				unpairedNode = oldPair[0].id === selectedPoint.id ? oldPair[1] : oldPair[0];
				uncolorNode();
			}
			else {
				// Start a new pair
				unpairedNode = selectedPoint;
				colorNode(currentColor);
			}
		}
		updateSolveEnabled();
	};

	function intAttr(node, attr) {
		return parseInt(node.getAttribute(attr), 10);
	};

	function solve() {
		currentGrid.finalize();
		d3.select("button.solve").attr("disabled", "disabled");
		isSolving = true;
		isEditing = false;
		Flow.Grid.View.getBoard().classed("editing", false);
		allowEdits = false;
		updateSolveEnabled();
		Flow.Solver.Solve(currentGrid, function(solved) {
			var msg = solved ? "Solved!" : "Has no solution.";
			isSolving = false;
			d3.select(".solve-msg").html(msg);
		});
	};
});