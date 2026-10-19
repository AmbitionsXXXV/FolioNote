export type JapaneseReadingLocale = "en-US" | "ja-JP" | "zh-CN"

export interface LocalizedReadingText {
  "en-US": string
  "ja-JP": string
  "zh-CN": string
}

export interface JapaneseReadingSentence {
  id: string
  /** Original text exactly as published; segmentation comes from japanese.analyze. */
  text: string
  translations: LocalizedReadingText
}

export interface JapaneseReadingWork {
  id: string
  title: string
  titleReading: string
  author: string
  authorReading: string
  firstPublishedYear: number
  descriptions: LocalizedReadingText
  sourceName: string
  sourceUrl: string
  rights: "public-domain"
  sentences: JapaneseReadingSentence[]
}

export const JAPANESE_READING_WORKS: JapaneseReadingWork[] = [
  {
    id: "kumo-no-ito",
    title: "蜘蛛の糸",
    titleReading: "くものいと",
    author: "芥川 竜之介",
    authorReading: "あくたがわ りゅうのすけ",
    firstPublishedYear: 1918,
    descriptions: {
      "en-US":
        "A quiet opening above the lotus pond, before the story descends from paradise into hell.",
      "ja-JP": "極楽の蓮池から地獄へ視線が移っていく、静かな冒頭の二文です。",
      "zh-CN": "从极乐莲池向地狱展开视线的安静开篇。"
    },
    sourceName: "青空文庫",
    sourceUrl: "https://www.aozora.gr.jp/cards/000879/card92.html",
    rights: "public-domain",
    sentences: [
      {
        id: "kumo-no-ito-1",
        text: "ある日の事でございます。",
        translations: {
          "en-US": "It was on a certain day.",
          "ja-JP": "ある日のことです。",
          "zh-CN": "这是某一天的事情。"
        }
      },
      {
        id: "kumo-no-ito-2",
        text: "御釈迦様は極楽の蓮池のふちを、独りでぶらぶら御歩きになっていらっしゃいました。",
        translations: {
          "en-US":
            "The Buddha was strolling alone along the edge of the lotus pond in paradise.",
          "ja-JP":
            "お釈迦様は、極楽の蓮池のほとりを一人でゆっくり歩いていました。",
          "zh-CN": "释迦牟尼佛独自在极乐的莲池边悠闲地走着。"
        }
      }
    ]
  },
  {
    id: "chumon-no-ooi-ryoriten",
    title: "注文の多い料理店",
    titleReading: "ちゅうもんのおおいりょうりてん",
    author: "宮沢 賢治",
    authorReading: "みやざわ けんじ",
    firstPublishedYear: 1924,
    descriptions: {
      "en-US":
        "Two hunters mistake a series of ominous instructions for signs of a thriving restaurant.",
      "ja-JP":
        "二人の紳士が、不思議な料理店の「注文」を都合よく読み違えていく場面です。",
      "zh-CN": "两位绅士把诡异餐厅的层层“要求”误解为生意兴隆。"
    },
    sourceName: "青空文庫",
    sourceUrl: "https://www.aozora.gr.jp/cards/000081/card43754.html",
    rights: "public-domain",
    sentences: [
      {
        id: "chumon-no-ooi-ryoriten-1",
        text: "「当軒は注文の多い料理店ですからどうかそこはご承知ください」",
        translations: {
          "en-US":
            "This restaurant receives many orders, so please understand.",
          "ja-JP": "当店は注文が多い料理店ですので、その点をご了承ください。",
          "zh-CN": "本店是一家要求很多的餐厅，请您多多包涵。"
        }
      },
      {
        id: "chumon-no-ooi-ryoriten-2",
        text: "二人は云いながら、その扉をあけました。",
        translations: {
          "en-US": "The two men opened the door as they spoke.",
          "ja-JP": "二人はそう話しながら、その扉を開けました。",
          "zh-CN": "两人一边说，一边打开了那扇门。"
        }
      }
    ]
  },
  {
    id: "gon-gitsune",
    title: "ごん狐",
    titleReading: "ごんぎつね",
    author: "新美 南吉",
    authorReading: "にいみ なんきち",
    firstPublishedYear: 1932,
    descriptions: {
      "en-US":
        "A village story introduces Gon, a lonely young fox whose mischief leads to a tragic misunderstanding.",
      "ja-JP":
        "村の語りから始まり、ひとりぼっちの小狐「ごん」を紹介する冒頭です。",
      "zh-CN": "从村庄传说开始，介绍孤零零的小狐狸“阿权”。"
    },
    sourceName: "青空文庫",
    sourceUrl: "https://www.aozora.gr.jp/cards/000121/card628.html",
    rights: "public-domain",
    sentences: [
      {
        id: "gon-gitsune-1",
        text: "これは、私が小さいときに、村の茂平というおじいさんからきいたお話です。",
        translations: {
          "en-US":
            "This is a story I heard as a child from an old man in the village named Mohei.",
          "ja-JP":
            "これは、私が幼いころ、村の茂平というおじいさんから聞いた話です。",
          "zh-CN": "这是我小时候从村里一位叫茂平的老人那里听来的故事。"
        }
      },
      {
        id: "gon-gitsune-2",
        text: "ごんは、一人ぼっちの小狐で、しだの一ぱいしげった森の中に穴をほって住んでいました。",
        translations: {
          "en-US":
            "Gon was a lonely young fox who lived in a hole he had dug in a forest thick with ferns.",
          "ja-JP":
            "ごんはひとりぼっちの小狐で、しだが生い茂る森に穴を掘って住んでいました。",
          "zh-CN": "阿权是一只孤零零的小狐狸，在长满蕨草的森林里挖洞生活。"
        }
      }
    ]
  }
]

export const resolveReadingLocale = (
  language: string
): JapaneseReadingLocale => {
  if (language.startsWith("ja")) {
    return "ja-JP"
  }
  if (language.startsWith("en")) {
    return "en-US"
  }
  return "zh-CN"
}
