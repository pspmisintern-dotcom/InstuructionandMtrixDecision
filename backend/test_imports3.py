import sys
results = []

def check(name, fn):
    try:
        fn()
        results.append(f"OK: {name}")
    except Exception as e:
        results.append(f"FAIL: {name}: {type(e).__name__}: {e}")

check("langchain.schema.Document", lambda: __import__("langchain.schema", fromlist=["Document"]))
check("langchain_classic.chains.RetrievalQA", lambda: __import__("langchain_classic.chains", fromlist=["RetrievalQA"]))
check("langchain_community.vectorstores.FAISS", lambda: __import__("langchain_community.vectorstores", fromlist=["FAISS"]))
check("langchain_text_splitters.RecursiveCharacterTextSplitter", lambda: __import__("langchain_text_splitters", fromlist=["RecursiveCharacterTextSplitter"]))
check("langchain_core.messages", lambda: __import__("langchain_core.messages", fromlist=["AIMessage", "HumanMessage"]))

with open("test_imports3_out.txt", "w") as f:
    f.write("\n".join(results))
