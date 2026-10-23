# Same flood fill, untyped GDScript with plain Arrays (how quick prototypes are often written).
extends SceneTree

func _init():
	var W = 40
	var H = 27
	var reps = 10000
	var args = OS.get_cmdline_user_args()
	if args.size() > 0:
		reps = int(args[0])
	var grid = []
	grid.resize(W * H)
	var rng = 12345
	for y in H:
		for x in W:
			var wall = 0
			if x == 0 or y == 0 or x == W - 1 or y == H - 1:
				wall = 1
			else:
				rng = (rng * 1103515245 + 12345) & 0x7fffffff
				if (rng >> 16) % 100 < 28:
					wall = 1
			grid[y * W + x] = wall
	var open = []
	for i in W * H:
		if grid[i] == 0:
			open.append(i)
	var seen = []
	seen.resize(W * H)
	seen.fill(0)
	var queue = []
	queue.resize(W * H)
	var total = 0
	var t0 = Time.get_ticks_usec()
	for r in reps:
		var start = open[(r * 7919) % open.size()]
		var stamp = r + 1
		var head = 0
		var tail = 1
		queue[0] = start
		seen[start] = stamp
		while head < tail:
			var c = queue[head]
			head += 1
			for d in [-1, 1, -W, W]:
				var n = c + d
				if grid[n] == 0 and seen[n] != stamp:
					seen[n] = stamp
					queue[tail] = n
					tail += 1
		total += tail
	var t1 = Time.get_ticks_usec()
	print("godot untyped: open=%d reps=%d total_cells=%d loop_ms=%.1f per_fill_us=%.2f" % [open.size(), reps, total, (t1 - t0) / 1000.0, float(t1 - t0) / reps])
	quit()
