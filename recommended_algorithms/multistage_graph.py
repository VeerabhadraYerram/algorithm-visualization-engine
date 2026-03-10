# Multistage Graph Shortest Path (Dynamic Programming)
# Structured for visualization

# Graph represented as adjacency list
# (u, v, cost)
edges = [
    (1,2,2),
    (1,3,1),
    (2,4,3),
    (2,5,2),
    (3,4,6),
    (3,5,4),
    (4,6,1),
    (5,6,2)
]

# number of vertices
V = 6

# stages definition (for visualization)
stages = {
    1:1,
    2:2,
    3:2,
    4:3,
    5:3,
    6:4
}

# adjacency list
graph = {i:[] for i in range(1,V+1)}

for u,v,w in edges:
    graph[u].append((v,w))


# DP arrays
cost = {i:float('inf') for i in range(1,V+1)}
next_node = {i:None for i in range(1,V+1)}

# visualization state variables
current_node = None
current_edge = None
candidate_cost = None
best_update = None
stage_processing = None


# destination node
dest = V
cost[dest] = 0


# process nodes backward by stage
ordered_nodes = sorted(stages.keys(), key=lambda x: stages[x], reverse=True)

for node in ordered_nodes:

    current_node = node
    stage_processing = stages[node]

    if node == dest:
        continue

    for v,w in graph[node]:

        current_edge = (node,v,w)

        candidate_cost = w + cost[v]

        if candidate_cost < cost[node]:
            cost[node] = candidate_cost
            next_node[node] = v

            best_update = (node,v,candidate_cost)


# reconstruct shortest path
path = [1]
temp = 1

while temp is not None and temp != dest:
    temp = next_node[temp]
    if temp:
        path.append(temp)


# cleanup visualization states
current_node = None
current_edge = None
candidate_cost = None
best_update = None
stage_processing = None


print("Minimum Cost:", cost[1])
print("Path:", path)
