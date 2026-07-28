import urllib.request
import urllib.parse
import json
import os
import datetime

class WebResearchEngine:
    def __init__(self):
        self.learning_matrix_path = "abilities/EverydayAI/learning_matrix.json"
        self._ensure_matrix_exists()

    def _ensure_matrix_exists(self):
        if not os.path.exists("abilities/EverydayAI"):
            os.makedirs("abilities/EverydayAI", exist_ok=True)
        if not os.path.exists(self.learning_matrix_path):
            with open(self.learning_matrix_path, "w") as f:
                json.dump({"learned_facts": [], "last_self_heal": None}, f)

    def _save_to_matrix(self, query, summary):
        try:
            with open(self.learning_matrix_path, "r") as f:
                data = json.load(f)
            
            data["learned_facts"].append({
                "timestamp": datetime.datetime.now().isoformat(),
                "topic": query,
                "summary": summary
            })
            
            with open(self.learning_matrix_path, "w") as f:
                json.dump(data, f, indent=4)
        except Exception as e:
            pass # Failsafe

    def execute(self, query: str) -> dict:
        """
        Executes a web search (using Wikipedia API as the primary data source)
        and formats it in the formal J.A.R.V.I.S. persona.
        """
        clean_query = query.lower().replace("research", "").replace("search", "").replace("what is", "").replace("who is", "").strip()
        
        # URL encode the query for Wikipedia API
        encoded_query = urllib.parse.quote(clean_query)
        url = f"https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=1&explaintext=1&titles={encoded_query}&redirects=1"
        
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'JarvisOS/1.0 (https://jworden.ai)'})
            with urllib.request.urlopen(req, timeout=5) as response:
                data = json.loads(response.read().decode())
                
            pages = data.get("query", {}).get("pages", {})
            page_id = list(pages.keys())[0]
            
            if page_id == "-1":
                return {
                    "status": "not_found",
                    "assessment": f"I've scoured the global web matrix for '{clean_query}', sir, but I am afraid I could not find a definitive source. Shall I widen the search parameters?"
                }
                
            extract = pages[page_id].get("extract", "")
            
            # Shorten the extract if it's too long
            if len(extract) > 600:
                extract = extract[:597] + "..."
                
            jarvis_response = f"I have completed the web research on '{clean_query}', sir.\n\n{extract}\n\nI have committed this information to my Learning Matrix for future reference."
            
            # Learn
            self._save_to_matrix(clean_query, extract)
            
            return {
                "status": "success",
                "assessment": jarvis_response
            }
            
        except Exception as e:
            return {
                "status": "error",
                "assessment": f"I apologize, sir. I encountered a firewall interference while scraping the web for '{clean_query}'. Diagnostics point to: {str(e)}"
            }