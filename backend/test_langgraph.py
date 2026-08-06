from typing import TypedDict
from langgraph.graph import StateGraph, END

class S(TypedDict, total=False):
    x: int

def n1(state):
    return {"x": 1}

def n2(state):
    return {"x": state.get("x", 0) + 1}

def router(state):
    return "n2" if state.get("x", 0) < 5 else "end"

g = StateGraph(S)
g.add_node("n1", n1)
g.add_node("n2", n2)
g.add_node("end", lambda s: {"x": 99})
g.set_entry_point("n1")
g.add_conditional_edges("n1", router, {"n2": "n2", "end": "end"})
g.add_conditional_edges("n2", router, {"n2": "n2", "end": "end"})
g.add_edge("end", END)
app = g.compile()
res = app.invoke({"x": 0})
print("RESULT", res)
print("HAS_ENTRY", hasattr(g, "set_entry_point"))
