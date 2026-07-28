import asyncio
import random
import logging
from typing import List, Dict, Any
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class Task:
    task_id: str
    description: str
    payload: Dict[str, Any]

class DummyAgent:
    def __init__(self, agent_id: str, specialty: str = "general"):
        self.agent_id = agent_id
        self.specialty = specialty

    async def process(self, task: Task) -> Dict[str, Any]:
        processing_time = random.uniform(0.1, 0.5)
        await asyncio.sleep(processing_time)
        return {
            "agent_id": self.agent_id,
            "task_id": task.task_id,
            "status": "success",
            "output": f"[{self.specialty}] Processed '{task.description}' in {processing_time:.2f}s"
        }

class SwarmRouter:
    """
    Implements Hierarchical Swarm Routing using Map-Reduce logic.
    """
    def __init__(self, agents: List[DummyAgent]):
        self.agents = agents
        
    def _map_task(self, main_task: str) -> List[Task]:
        return [
            Task(task_id="sub-1", description=f"Analyze data for '{main_task}'", payload={}),
            Task(task_id="sub-2", description=f"Fetch context for '{main_task}'", payload={}),
            Task(task_id="sub-3", description=f"Draft initial response for '{main_task}'", payload={})
        ]

    async def _route_and_execute(self, tasks: List[Task]) -> List[Dict[str, Any]]:
        pending_coroutines = []
        for i, task in enumerate(tasks):
            assigned_agent = self.agents[i % len(self.agents)]
            pending_coroutines.append(assigned_agent.process(task))
        return await asyncio.gather(*pending_coroutines, return_exceptions=True)

    def _reduce_results(self, main_task: str, results: List[Any]) -> Dict[str, Any]:
        aggregated_output = []
        for res in results:
            if isinstance(res, Exception):
                aggregated_output.append(f"Error: {str(res)}")
            else:
                aggregated_output.append(res.get("output", ""))
        return {
            "main_task": main_task,
            "final_synthesis": " | ".join(aggregated_output),
            "sub_results": results
        }

    async def run(self, main_task: str) -> Dict[str, Any]:
        subtasks = self._map_task(main_task)
        results = await self._route_and_execute(subtasks)
        return self._reduce_results(main_task, results)


class SwarmRouterEngine:
    def __init__(self):
        agents = [DummyAgent("agent-1", "analyzer"), DummyAgent("agent-2", "context"), DummyAgent("agent-3", "drafter")]
        self.router = SwarmRouter(agents)

    def execute(self, params: dict = None) -> dict:
        params = params or {}
        main_task = params.get("main_task") or params.get("query") or "Paving Swarm Task Dispatch"
        import asyncio
        return asyncio.run(self.router.run(main_task))
