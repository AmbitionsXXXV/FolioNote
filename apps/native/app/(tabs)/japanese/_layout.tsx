import { useTranslation } from "react-i18next"

import { TabStack } from "@/components/tab-stack"

export default function JapaneseLayout() {
  const { t } = useTranslation()

  return (
    <TabStack>
      <TabStack.Screen
        name="index"
        options={{
          title: t("japanese.title"),
          headerLargeTitle: true,
          headerLargeTitleShadowVisible: false
        }}
      />
    </TabStack>
  )
}
