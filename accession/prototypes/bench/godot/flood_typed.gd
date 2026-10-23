# 40x27 grid, 4-neighbour BFS flood fill, repeated REPS times; typed GDScript + PackedInt32Array.
extends SceneTree

const W := 40
const H := 27

func _init() -> void:
	var t_start := Time.get_ticks_usec()
	var reps := 10000
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		reps = int(args[0])
	var grid := PackedInt32Array()
	grid.resize(W * H)
	var rng: int = 12345
	for y in H:
		for x in W:
			var wall := 0
			if x == 0 or y == 0 or x == W - 1 or y == H - 1:
				wall = 1
			else:
				rng = (rng * 1103515245 + 12345) & 0x7fffffff
				if (rng >> 16) % 100 < 28:
					wall = 1
			grid[y * W + x] = wall
	var open := PackedInt32Array()
	for i in W * H:
		if grid[i] == 0:
			open.append(i)
	var seen := PackedInt32Array()
	seen.resize(W * H)
	var queue := PackedInt32Array()
	queue.resize(W * H)
	var n_open: int = open.size()
	var total: int = 0
	var t0 := Time.get_ticks_usec()
	for r in reps:
		var start: int = open[(r * 7919) % n_open]
		var stamp: int = r + 1
		var head: int = 0
		var tail: int = 1
		queue[0] = start
		seen[start] = stamp
		while head < tail:
			var c: int = queue[head]
			head += 1
			var n: int = c - 1
			if grid[n] == 0 and seen[n] != stamp:
				seen[n] = stamp
				queue[tail] = n
				tail += 1
			n = c + 1
			if grid[n] == 0 and seen[n] != stamp:
				seen[n] = stamp
				queue[tail] = n
				tail += 1
			n = c - W
			if grid[n] == 0 and seen[n] != stamp:
				seen[n] = stamp
				queue[tail] = n
				tail += 1
			n = c + W
			if grid[n] == 0 and seen[n] != stamp:
				seen[n] = stamp
				queue[tail] = n
				tail += 1
		total += tail
	var t1 := Time.get_ticks_usec()
	print("godot typed: open=%d reps=%d total_cells=%d loop_ms=%.1f per_fill_us=%.2f since_init_ms=%.1f engine_ms_before_init=%d" % [n_open, reps, total, (t1 - t0) / 1000.0, float(t1 - t0) / reps, (t1 - t_start) / 1000.0, t_start / 1000])
	quit()
