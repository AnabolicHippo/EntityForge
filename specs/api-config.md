# API Configuration & Authentication

## API Key Management

### Storage
- Store API key in `window.storage` under key `ef2-api-key`
- Load on app mount alongside other persisted state
- Never expose key in UI after entry (mask with dots)

### Entry UI
- Settings icon (gear) in left sidebar header, next to ruleset selector
- Clicking opens a small inline form (not modal) below the header
- Input field: `type="password"`, placeholder "Anthropic API key (sk-ant-...)"
- Save button persists to storage
- Clear button removes stored key
- Status indicator: green dot when key is set, red dot when missing

### Header Injection
All Anthropic API requests must include:
```
headers: {
  "Content-Type": "application/json",
  "x-api-key": "{stored_key}",
  "anthropic-version": "2023-06-01",
  "anthropic-dangerous-direct-browser-access": "true"
}
```

### Validation
- Before any generation: check if key exists
- If missing: display error banner "API key required. Click ⚙️ to configure."
- Do not attempt API calls without a key
- On 401 response: display "Invalid API key. Check your key in settings."

### Security
- Key stored in `window.storage` (same origin policy applies)
- Never log key to console
- Never include key in error messages
- Never persist key in workflow or entity exports

### Error States
- No key configured: block generation, show setup prompt
- Invalid key (401): show error, keep key for user to update
- Rate limited (429): show "Rate limited. Wait a moment and try again."
- Server error (500+): show "Anthropic API error. Try again later."
