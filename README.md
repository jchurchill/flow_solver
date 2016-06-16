# Flow Solver
Solver and interface for the phone game Flow.

Flow is a puzzle game.
You are presented with a grid containing a set of colored pairs of locations on the grid.

The goal is to connect all color pairs with a path, where a path occupies locations in the grid, and no two paths may intersect (i.e., each grid square may only contain at most one path segment).

[This problem has been shown to be NP-complete.](https://en.wikipedia.org/wiki/Numberlink)

This code is a solver for a flow board that uses simple backtracking along with other minor optimizations to attempt to search the space of solutions as quickly and efficiently as possible. It does not try to achieve the board-filling condition. The general idea is given by this psuedocode:

```
function solve(board, color_i) {
  if (color_i >= board.colors.length) {
    return true; // can be solved, and the current state of the board holds the solution
  }
  color = board.colors[color_i];
  paths_iterator = get_valid_paths_iterator(board, color);
  while (paths_iterator.next()) {
    path = paths_iterator.current();
    board.apply_path(path);
    if (solve(board, color_i + 1)) {
      return true;
    }
    board.remove_path(path);
  }
  return false;
}

get_valid_paths_iterator(board, color_i) {
  // Let color_endpoints = A .. B
  // Perform a depth first search starting at A, on the graph that is the flow board (where adjacencies are edges).
  // Maintain a stack of nodes currently in the path and do not visit a node already in the stack when exploring.
  // Yield the current stack as a path when reaching B at any point during the search.
}
```

The pseudocode for `get_valid_paths_iterator` is omitted for simplicity.

[Here is the algorithm in action on a real 8x8 board from the flow game.](https://gfycat.com/MajesticSneakyBaboon)
