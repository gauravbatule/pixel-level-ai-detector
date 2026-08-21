"""
Merge all 29 Design Languages into UI/UX Pro Max Skill and generate Markdown Design Vault
"""

import csv
import os

CSV_PATH = r'C:\Users\Gaurav Batule\Documents\antigravity\serene-davinci\ui-ux-pro-max-skill\src\ui-ux-pro-max\data\styles.csv'
VAULT_MD_PATH = r'C:\Users\Gaurav Batule\Documents\antigravity\serene-davinci\ui-ux-pro-max-skill\docs\29_DESIGN_LANGUAGES_VAULT.md'
PROJECT_VAULT_PATH = r'C:\Users\Gaurav Batule\Desktop\_Projects\AI pixel level\ai-pixel-detector\docs\29_DESIGN_LANGUAGES_VAULT.md'

from add_design_languages import DESIGN_LANGUAGES_29

# 1. Read existing styles
existing_names = set()
rows = []
header = []

if os.path.exists(CSV_PATH):
    with open(CSV_PATH, mode='r', encoding='utf-8', errors='ignore') as f:
        reader = csv.reader(f)
        header = next(reader)
        for r in reader:
            if len(r) > 1:
                rows.append(r)
                existing_names.add(r[1].lower().strip())

# 2. Append new design languages if not already present
added_count = 0
current_no = len(rows) + 1

for d in DESIGN_LANGUAGES_29:
    name = d["name"]
    if name.lower().strip() not in existing_names:
        row = [
            str(current_no),
            d["category"],
            d["type"],
            d["keywords"],
            d["primary"],
            d["secondary"],
            d["effects"],
            d["best_for"],
            d["do_not_use"],
            d["light"],
            d["dark"],
            d["perf"],
            d["a11y"],
            d["mobile"],
            d["conv"],
            d["framework"],
            d["era"],
            d["complexity"],
            d["prompt"],
            d["css"],
            d["checklist"],
            d["vars"]
        ]
        rows.append(row)
        existing_names.add(name.lower().strip())
        current_no += 1
        added_count += 1

# 3. Write back updated CSV
with open(CSV_PATH, mode='w', encoding='utf-8', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(header)
    writer.writerows(rows)

print(f"Successfully updated styles.csv. Added {added_count} new design language entries (Total: {len(rows)}).")

# 4. Generate Markdown Vault
os.makedirs(os.path.dirname(VAULT_MD_PATH), exist_ok=True)
os.makedirs(os.path.dirname(PROJECT_VAULT_PATH), exist_ok=True)

md_content = """# 🎨 The Complete 29 Design Languages & Visual Systems Vault

This design intelligence catalog integrates the 29 visual aesthetics into the agent skill system with exact color palettes, typography, CSS directives, and implementation checklists.

---

"""

for i, d in enumerate(DESIGN_LANGUAGES_29, 1):
    md_content += f"""## {i}. {d['name']}
- **Category / Type**: `{d['category']}` ({d['type']})
- **Keywords**: {d['keywords']}
- **Primary Palette**: `{d['primary']}`
- **Secondary Palette**: `{d['secondary']}`
- **Effects & Animation**: {d['effects']}
- **Best For**: {d['best_for']}
- **Avoid For**: {d['do_not_use']}
- **Framework Support**: {d['framework']} | **Era**: {d['era']} | **Complexity**: {d['complexity']}

### 💻 Implementation CSS & Variables
```css
/* CSS Technical Implementation */
{d['css']}

/* Design Tokens */
{d['vars']}
```

### 🤖 AI Prompting Formula
> "{d['prompt']}"

---

"""

with open(VAULT_MD_PATH, mode='w', encoding='utf-8') as f:
    f.write(md_content)

with open(PROJECT_VAULT_PATH, mode='w', encoding='utf-8') as f:
    f.write(md_content)

print(f"Generated 29 Design Languages Vault at:\n  - {VAULT_MD_PATH}\n  - {PROJECT_VAULT_PATH}")
