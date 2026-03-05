# Dijkstra's Shortest Path with visualization variables

import heapq

edges = [
    (1,2,2),
    (1,3,3),
    (2,3,1),
    (2,4,1),
    (3,4,4),
    (3,5,5),
    (4,5,1)
]

V = 5
source = 1

# Build adjacency list
graph = {i: [] for i in range(1, V+1)}

for u, v, w in edges:
    graph[u].append((v, w))
    graph[v].append((u, w))   # remove if graph should be directed


# Visualization states
dist = {i: float("inf") for i in range(1, V+1)}
parent = {i: None for i in range(1, V+1)}

visited = set()

current = None        # node currently being processed
checking = None       # edge currently being relaxed
updated = None        # node whose distance was updated


dist[source] = 0

pq = [(0, source)]

while pq:

    d, u = heapq.heappop(pq)

    if u in visited:
        continue

    current = u
    visited.add(u)

    for v, w in graph[u]:

        checking = (u, v, w)

        if v not in visited and dist[u] + w < dist[v]:

            dist[v] = dist[u] + w
            parent[v] = u

            updated = v

            heapq.heappush(pq, (dist[v], v))


# cleanup visualization state
current = None
checking = None
updated = None


print("Shortest distances:", dist)
print("Parent tree:", parent)