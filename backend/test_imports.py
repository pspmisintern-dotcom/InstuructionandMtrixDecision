import sys
results = []

def check(name, fn):
    try:
        fn()
        results.append(f"OK: {name}")
    except Exception as e:
        results.append(f"FAIL: {name}: {type(e).__name__}: {e}")

check("langchain", lambda: __import__("langchain"))
check("langgraph", lambda: __import__("langgraph"))
check("faiss", lambda: __import__("faiss"))
check("langgraph.graph.StateGraph", lambda: __import__("langgraph.graph", fromlist=["StateGraph", "END"]))
check("langchain_community.vectorstores.FAISS", lambda: __import__("langchain_community.vectorstores", fromlist=["FAISS"]))
check("langchain_core.documents", lambda: __import__("langchain_core.documents", fromlist=["Document"]))
check("langchain.text_splitter", lambda: __import__("langchain.text_splitter", fromlist=["RecursiveCharacterTextSplitter"]))
check("RetrievalQA", lambda: __import__("langchain.chains", fromlist=["RetrievalQA"]))

with open("test_imports_out.txt", "w") as f:
    f.write("\n".join(results))
print("\n".join(results))
