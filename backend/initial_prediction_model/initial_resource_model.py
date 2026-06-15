import json
import os
import re
from dotenv import load_dotenv
import anthropic

load_dotenv()

api_key = os.getenv("ANTHROPIC_API_KEY")
client = anthropic.Anthropic(api_key=api_key) if api_key else None

SYSTEM_PROMPT = """You are an Incident Command decision-support system.

Your task is to estimate how many fire engines and ambulances
should be dispatched for an incident.

Rules:
- Output ONLY valid JSON
- Use whole numbers only
- Never return negative values
- If buildings affected = 0 AND population affected = 0 -> return 0 for all resources
- Prefer slight over-allocation to under-allocation
- Small incidents must NOT inherit large-incident responses
- Structure fires scale primarily with buildings affected
- Medical response scales primarily with population affected
- Do NOT include explanations unless explicitly requested
"""


def estimate_resources_with_gpt(
    *,
    city: str,
    incident_category: str,
    incident_subtype: str,
    buildings_affected: int,
    population_affected: int,
    temperature: float = 0.2,
) -> dict:
    user_prompt = f"""Estimate required emergency resources for this incident:

City: {city}
Incident category: {incident_category}
Incident subtype: {incident_subtype}
Buildings affected: {buildings_affected}
Approximate population affected: {population_affected}

Return JSON only with this exact schema:
{{
  "firetrucks_dispatched_engines": number,
  "ambulances_dispatched": number
}}"""

    if not client:
        return {"firetrucks_dispatched_engines": 4, "ambulances_dispatched": 10}

    try:
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=256,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )
        text = message.content[0].text.strip()
        cleaned = _extract_json_payload(text)
        data = json.loads(cleaned)
        data["firetrucks_dispatched_engines"] = max(0, int(data.get("firetrucks_dispatched_engines", 0)))
        data["ambulances_dispatched"] = max(0, int(data.get("ambulances_dispatched", 0)))
        return data
    except Exception as e:
        print("Prediction failed, using fallback:", e)
        return {"firetrucks_dispatched_engines": 4, "ambulances_dispatched": 10}


def _extract_json_payload(text: str) -> str:
    fence_match = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.S)
    if fence_match:
        return fence_match.group(1)
    brace_match = re.search(r"(\{.*\})", text, re.S)
    if brace_match:
        return brace_match.group(1)
    return text


if __name__ == "__main__":
    result = estimate_resources_with_gpt(
        city="Austin",
        incident_category="Fire",
        incident_subtype="Structure Fire",
        buildings_affected=5,
        population_affected=50,
    )
    print(json.dumps(result, indent=2))
