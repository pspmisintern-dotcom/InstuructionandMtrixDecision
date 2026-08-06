import sys
results = []

def check(name, fn):
    try:
        fn()
        results.append(f"OK: {name}")
    except Exception as e:
        results.append(f"FAIL: {name}: {type(e).__name__}: {e}")

check("numpy", lambda: __import__("numpy"))
check("langchain_core.prompts.PromptTemplate", lambda: __import__("langchain_core.prompts", fromlist=["PromptTemplate"]))
check("langchain_core.documents.Document", lambda: __import__("langchain_core.documents", fromlist=["Document"]))
check("langchain_openai.ChatOpenAI", lambda: __import__("langchain_openai", fromlist=["ChatOpenAI"]))
check("langchain_openai.OpenAIEmbeddings", lambda: __import__("langchain_openai", fromlist=["OpenAIEmbeddings"]))
check("langchain_classic.chains.RetrievalQA", lambda: __import__("langchain_classic.chains", fromlist=["RetrievalQA"]))
check("langchain.chains.combine_documents.create_stuff_documents_chain", lambda: __import__("langchain.chains.combine_documents", fromlist=["create_stuff_documents_chain"]))
check("langchain.chains.retrieval.create_retrieval_chain", lambda: __import__("langchain.chains.retrieval", fromlist=["create_retrieval_chain"]))
check("langchain_community.embeddings.OllamaEmbeddings", lambda: __import__("langchain_community.embeddings", fromlist=["OllamaEmbeddings"]))
check("sentence_transformers", lambda: __import__("sentence_transformers"))
check("langchain_huggingface", lambda: __import__("langchain_huggingface"))

with open("test_imports2_out.txt", "w") as f:
    f.write("\n".join(results))
