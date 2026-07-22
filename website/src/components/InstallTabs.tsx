import { Tab, TabList, TabPanel, Tabs } from "@comp0/react";

import { CodeBlock } from "./CodeBlock.tsx";

export function InstallTabs() {
  return (
    <Tabs defaultValue="script">
      <TabList className="flex" aria-label="Install methods">
        <Tab
          tab="script"
          className="
            border-[3px] border-b-0 border-ink px-4 py-2 font-mono text-sm
            font-bold tracking-wide uppercase
            data-focus-visible:outline-2 data-focus-visible:outline-offset-2
            data-focus-visible:outline-blue
            data-hovered:bg-lime
            data-selected:bg-ink data-selected:text-paper
            data-selected:data-hovered:bg-ink
          "
        >
          install script
        </Tab>
        <Tab
          tab="source"
          className="
            border-[3px] border-b-0 border-ink px-4 py-2 font-mono text-sm
            font-bold tracking-wide uppercase
            data-focus-visible:outline-2 data-focus-visible:outline-offset-2
            data-focus-visible:outline-blue
            data-hovered:bg-lime
            data-selected:bg-ink data-selected:text-paper
            data-selected:data-hovered:bg-ink
          "
        >
          from source
        </Tab>
      </TabList>
      <TabPanel tab="script">
        <CodeBlock code="curl -fsSL https://raw.githubusercontent.com/johnpangalos/freellama/main/install.sh | sh" />
      </TabPanel>
      <TabPanel tab="source">
        <CodeBlock
          code={`git clone https://github.com/johnpangalos/freellama\ncd freellama\ndeno task install`}
        />
      </TabPanel>
    </Tabs>
  );
}
