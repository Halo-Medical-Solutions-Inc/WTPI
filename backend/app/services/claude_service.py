import json
from typing import Any, Optional

from anthropic import AsyncAnthropic

from app.config import settings


class ClaudeService:
    def __init__(self) -> None:
        self.client: AsyncAnthropic = AsyncAnthropic(
            api_key=settings.CLAUDE_API_KEY,
            timeout=120.0
        )
        self.model: str = settings.CLAUDE_EXTRACTION_MODEL

    def _build_extraction_prompt(
        self,
        transcript: str,
        assistant_prompt: str,
        extraction_schema: dict[str, Any],
    ) -> str:
        extraction_schema_json = json.dumps(extraction_schema, indent=2)

        prompt = f"""You are a data extraction assistant for a medical receptionist call center.

A call has just been completed. Your task is to extract structured data from the call transcript based on the provided extraction schema.

## Assistant Instructions (What the AI was told to do)

{assistant_prompt}

## Call Transcript

{transcript}

## Extraction Schema

The following JSON schema defines the fields you must extract from this call:

{extraction_schema_json}

## Instructions

1. Analyze the call transcript carefully
2. Extract values for each field defined in the extraction schema
3. Use the field descriptions to understand what data to extract
4. For boolean fields, determine true/false based on the conversation
5. For enum fields, select from the provided options only
6. If a value cannot be determined from the call, use null
7. Be accurate - only extract information that is clearly present in the transcript

**Handling transcription errors:** Call transcripts often contain typos, misheard names, or phonetic spellings produced by the speech-to-text transcriber. The practice name is **West Texas Pain Institute** — always use this exact name in the summary and all fields, never a transcription variant like "West Texas Pain Center" or "WTP Institute". Apply the following corrections:

- **Provider and team names:** When the transcript mentions a provider or team that is close to an option in the provided lists — similar sounding, phonetically alike, or a clear misspelling (e.g. "Doctor Lopes" or "Doctor Lopaz" → "Dr. Raul Lopez", "Iliana" or "Yi" → "Ilyana Yee, NP", "Ogas" → "Monica Ogaz, NP", "Fischer" → "Lucia Fisher, NP", "Amanda Lopes" → "Amanda Lopez, PA") — select the matching option. Do not use the transcribed text verbatim when a correct option exists. For provider_name: match to the closest provider in the enum. For call_teams: use the exact team titles from the schema. Infer the best team(s) from provider, context, and available teams. In the summary, use the correct provider name from the schema and the team names as listed, not the raw transcript.

- **Caller and patient names:** The transcriber often misspells names. When the caller spells out their name letter by letter, always prioritize the spelled-out version — it is the caller's own spelling and is virtually always closer to correct than what the transcriber heard phonetically. Even if the transcriber garbles some of the individual letters, reconstruct the name from the spelled-out letters as faithfully as possible. Only use the phonetic/spoken version to fill in gaps where the spelled-out letters are clearly corrupted beyond recognition. For example, if the transcriber heard "Monica Schwartz" but the caller spelled "M-a-n-d-i-k-a S-w-a-r-t-z", use "Mandika Swartz" — trusting the spelled-out letters over the phonetic version. Always use the spelled-out result for caller_name, patient_name, and the summary.

Return ONLY a valid JSON object matching the extraction schema. Do not include any explanation or markdown formatting."""

        return prompt

    async def extract_call_data(
        self,
        transcript: str,
        assistant_prompt: str,
        extraction_schema: dict[str, Any],
        retry_count: int = 0,
    ) -> Optional[dict[str, Any]]:
        max_retries = 1

        if not transcript or transcript.strip() == "":
            print("[CLAUDE_SERVICE] No transcript available, skipping extraction")
            return None

        prompt = self._build_extraction_prompt(
            transcript=transcript,
            assistant_prompt=assistant_prompt,
            extraction_schema=extraction_schema,
        )

        try:
            full_text = ""
            async with self.client.messages.stream(
                model=self.model,
                max_tokens=4096,
                messages=[
                    {"role": "user", "content": prompt},
                    {"role": "assistant", "content": "{"}
                ]
            ) as stream:
                async for text_delta in stream.text_stream:
                    full_text += text_delta

            json_string = "{" + full_text
            print(f"[CLAUDE_SERVICE] Raw extraction response: {json_string[:500]}...")

            try:
                result = json.loads(json_string)
                print("[CLAUDE_SERVICE] Extraction successful")
                return result
            except json.JSONDecodeError as e:
                print(f"[CLAUDE_SERVICE] JSON decode error: {e}")
                if retry_count < max_retries:
                    print(f"[CLAUDE_SERVICE] Retrying extraction (attempt {retry_count + 1})")
                    return await self.extract_call_data(
                        transcript=transcript,
                        assistant_prompt=assistant_prompt,
                        extraction_schema=extraction_schema,
                        retry_count=retry_count + 1,
                    )
                return None

        except Exception as e:
            print(f"[CLAUDE_SERVICE] Error during extraction: {e}")
            if retry_count < max_retries:
                print(f"[CLAUDE_SERVICE] Retrying extraction (attempt {retry_count + 1})")
                return await self.extract_call_data(
                    transcript=transcript,
                    assistant_prompt=assistant_prompt,
                    extraction_schema=extraction_schema,
                    retry_count=retry_count + 1,
                )
            return None


claude_service = ClaudeService()
