import re

file_path = '/Volumes/WEB_DEV/hub-wrdigital/hub-app/app/(app)/editorial-plan/client.tsx'
with open(file_path, 'r') as f:
    content = f.read()

# 1. Riduciamo le dimensioni delle icone social
content = content.replace('"w-8 h-8 rounded-full', '"w-7 h-7 rounded-full')
content = content.replace('<Icon className="h-4 w-4" />', '<Icon className="h-3.5 w-3.5" />')

# 2. Rendiamo il Collapsible aperto di default e togliamo il max-h-[30vh] per farlo scorrere naturalmente
content = content.replace('<Collapsible>', '<Collapsible defaultOpen={true}>')
content = content.replace('className="pt-3 space-y-4 px-2 pb-2 overflow-y-auto max-h-[30vh]"', 'className="pt-3 space-y-4 px-2 pb-2"')

# Rendiamo la colonna di sinistra scrollabile
content = content.replace('className="flex flex-col h-full bg-white rounded-xl border overflow-hidden shadow-sm"', 'className="flex flex-col h-full bg-white rounded-xl border shadow-sm overflow-y-auto overflow-x-hidden"')

with open(file_path, 'w') as f:
    f.write(content)

print("UI successfully fixed.")
