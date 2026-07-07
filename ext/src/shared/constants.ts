export const IFRAME_ID = 'outputIframeEl';

export const SELECTORS = {
  prompt: 'textarea.paragraph-input[data-name="description"]',
  negative: 'textarea.paragraph-input[data-name="negative"]',
  numImages: 'input.text-input[data-name="numImages"]',
  generateButton: 'button#generateButtonEl',
  outputArea: 'div#outputAreaEl',
  imageIframe: 'iframe.text-to-image-plugin-image-iframe',
  resultImg: 'img#resultImgEl',
  artStyle: 'select[data-name="artStyle"]',
} as const satisfies Record<string, string>;

export const STORAGE_KEYS = {
  negativePrompt: 'negativePrompt',
  numImages: 'numImages',
  prompts: 'prompts',
  folderName: 'folderName',
  prefix: 'prefix',
  suffix: 'suffix',
  workerCount: 'workerCount',
} as const satisfies Record<string, string>;

export const FILENAME_PATTERNS = {
  prompt_text_image_idx: '{prompt_text}_{image_idx}',
  prompt_idx_image_idx: '{prompt_idx}_{image_idx}',
  timestamp_image_idx: '{timestamp}_{image_idx}',
  prompt_idx_prompt_text_image_idx: '{prompt_idx}_{prompt_text}_{image_idx}',
} as const satisfies Record<string, string>;

export type FilenamePatternKey = keyof typeof FILENAME_PATTERNS;

export const FILENAME_PATTERN_LABELS: Record<FilenamePatternKey, string> = {
  prompt_text_image_idx: '{prompt_text}_{image_idx}',
  prompt_idx_image_idx: '{prompt_idx}_{image_idx}',
  timestamp_image_idx: '{timestamp}_{image_idx}',
  prompt_idx_prompt_text_image_idx: '{prompt_idx}_{prompt_text}_{image_idx}',
};

export const DEFAULTS = {
  numImages: 2,
  maxRetries: 3,
  pollInterval: 500,
  maxPollTime: 120000,
  imageLoadTimeout: 30000,
  workerCount: 2,
  workerCreateTimeout: 20000,
  saveAs: false,
  filenamePattern: 'prompt_idx_image_idx' as FilenamePatternKey,
  perPromptFolders: false,
  foregroundIntervalMs: 5000,
} as const;

export const ART_STLYE = [
  {
    value: 'ref:optionKeyName:Painted Anime Plus',
    label: 'Painted Anime Plus',
  },
  {
    value: 'ref:optionKeyName:Painted Anime',
    label: 'Painted Anime',
  },
  {
    value: 'ref:optionKeyName:Casual Photo',
    label: 'Casual Photo',
  },
  {
    value: 'ref:optionKeyName:Cinematic',
    label: 'Cinematic',
  },
  {
    value: 'ref:optionKeyName:Digital Painting',
    label: 'Digital Painting',
  },
  {
    value: 'ref:optionKeyName:Realistic images',
    label: 'Realistic images',
  },
  {
    value: 'ref:optionKeyName:Realistic humans',
    label: 'Realistic humans',
  },
  {
    value: 'ref:optionKeyName:𝗡𝗼 𝘀𝘁𝘆𝗹𝗲',
    label: '𝗡𝗼 𝘀𝘁𝘆𝗹𝗲',
  },
  {
    value: 'ref:optionKeyName:Anti-NSFW',
    label: 'Anti-NSFW',
  },
  {
    value: 'ref:optionKeyName:League of Legends',
    label: 'League of Legends',
  },
  {
    value: 'ref:optionKeyName:Concept Art',
    label: 'Concept Art',
  },
  {
    value: 'ref:optionKeyName:3D Disney Character',
    label: '3D Disney Character',
  },
  {
    value: 'ref:optionKeyName:2D Disney Character',
    label: '2D Disney Character',
  },
  {
    value: 'ref:optionKeyName:Disney Sketch',
    label: 'Disney Sketch',
  },
  {
    value: 'ref:optionKeyName:Concept Sketch',
    label: 'Concept Sketch',
  },
  {
    value: 'ref:optionKeyName:Painterly',
    label: 'Painterly',
  },
  {
    value: 'ref:optionKeyName:Oil Painting',
    label: 'Oil Painting',
  },
  {
    value: 'ref:optionKeyName:Oil Painting - Realism',
    label: 'Oil Painting - Realism',
  },
  {
    value: 'ref:optionKeyName:Oil Painting - Old',
    label: 'Oil Painting - Old',
  },
  {
    value: 'ref:optionKeyName:Professional Photo',
    label: 'Professional Photo',
  },
  {
    value: 'ref:optionKeyName:Anime',
    label: 'Anime',
  },
  {
    value: 'ref:optionKeyName:Drawn Anime',
    label: 'Drawn Anime',
  },
  {
    value: 'ref:optionKeyName:Cute Anime',
    label: 'Cute Anime',
  },
  {
    value: 'ref:optionKeyName:Soft Anime',
    label: 'Soft Anime',
  },
  {
    value: 'ref:optionKeyName:Mix Anime',
    label: 'Mix Anime',
  },
  {
    value: 'ref:optionKeyName:Fantasy Painting',
    label: 'Fantasy Painting',
  },
  {
    value: 'ref:optionKeyName:Fantasy Landscape',
    label: 'Fantasy Landscape',
  },
  {
    value: 'ref:optionKeyName:Fantasy Portrait',
    label: 'Fantasy Portrait',
  },
  {
    value: 'ref:optionKeyName:Studio Ghibli',
    label: 'Studio Ghibli',
  },
  {
    value: 'ref:optionKeyName:50s Enamel Sign',
    label: '50s Enamel Sign',
  },
  {
    value: 'ref:optionKeyName:Vintage Comic',
    label: 'Vintage Comic',
  },
  {
    value: 'ref:optionKeyName:Franco-Belgian Comic',
    label: 'Franco-Belgian Comic',
  },
  {
    value: 'ref:optionKeyName:Tintin Comic',
    label: 'Tintin Comic',
  },
  {
    value: 'ref:optionKeyName:90s Comic',
    label: '90s Comic',
  },
  {
    value: 'ref:optionKeyName:90s Superhero',
    label: '90s Superhero',
  },
  {
    value: 'ref:optionKeyName:Medieval',
    label: 'Medieval',
  },
  {
    value: 'ref:optionKeyName:Pixel Art',
    label: 'Pixel Art',
  },
  {
    value: 'ref:optionKeyName:Cute Figurine',
    label: 'Cute Figurine',
  },
  {
    value: 'ref:optionKeyName:3D Emoji',
    label: '3D Emoji',
  },
  {
    value: 'ref:optionKeyName:Illustration',
    label: 'Illustration',
  },
  {
    value: 'ref:optionKeyName:Flat Illustration',
    label: 'Flat Illustration',
  },
  {
    value: 'ref:optionKeyName:Watercolor',
    label: 'Watercolor',
  },
  {
    value: 'ref:optionKeyName:1990s Photo',
    label: '1990s Photo',
  },
  {
    value: 'ref:optionKeyName:1980s Photo',
    label: '1980s Photo',
  },
  {
    value: 'ref:optionKeyName:1970s Photo',
    label: '1970s Photo',
  },
  {
    value: 'ref:optionKeyName:1960s Photo',
    label: '1960s Photo',
  },
  {
    value: 'ref:optionKeyName:1950s Photo',
    label: '1950s Photo',
  },
  {
    value: 'ref:optionKeyName:1940s Photo',
    label: '1940s Photo',
  },
  {
    value: 'ref:optionKeyName:1930s Photo',
    label: '1930s Photo',
  },
  {
    value: 'ref:optionKeyName:1920s Photo',
    label: '1920s Photo',
  },
  {
    value: 'ref:optionKeyName:Vintage Pulp Art',
    label: 'Vintage Pulp Art',
  },
  {
    value: 'ref:optionKeyName:50s Infomercial Anime',
    label: '50s Infomercial Anime',
  },
  {
    value: 'ref:optionKeyName:3D Pokemon',
    label: '3D Pokemon',
  },
  {
    value: 'ref:optionKeyName:Painted Pokemon',
    label: 'Painted Pokemon',
  },
  {
    value: 'ref:optionKeyName:2D Pokemon',
    label: '2D Pokemon',
  },
  {
    value: 'ref:optionKeyName:Vintage Anime',
    label: 'Vintage Anime',
  },
  {
    value: 'ref:optionKeyName:Neon Vintage Anime',
    label: 'Neon Vintage Anime',
  },
  {
    value: 'ref:optionKeyName:Manga',
    label: 'Manga',
  },
  {
    value: 'ref:optionKeyName:Fantasy World Map',
    label: 'Fantasy World Map',
  },
  {
    value: 'ref:optionKeyName:Fantasy City Map',
    label: 'Fantasy City Map',
  },
  {
    value: 'ref:optionKeyName:Old World Map',
    label: 'Old World Map',
  },
  {
    value: 'ref:optionKeyName:3D Isometric Icon',
    label: '3D Isometric Icon',
  },
  {
    value: 'ref:optionKeyName:Flat Style Icon',
    label: 'Flat Style Icon',
  },
  {
    value: 'ref:optionKeyName:Flat Style Logo',
    label: 'Flat Style Logo',
  },
  {
    value: 'ref:optionKeyName:Game Art Icon',
    label: 'Game Art Icon',
  },
  {
    value: 'ref:optionKeyName:Digital Painting Icon',
    label: 'Digital Painting Icon',
  },
  {
    value: 'ref:optionKeyName:Concept Art Icon',
    label: 'Concept Art Icon',
  },
  {
    value: 'ref:optionKeyName:Cute 3D Icon',
    label: 'Cute 3D Icon',
  },
  {
    value: 'ref:optionKeyName:Cute 3D Icon 𝗦𝗲𝘁',
    label: 'Cute 3D Icon 𝗦𝗲𝘁',
  },
  {
    value: 'ref:optionKeyName:Crayon Drawing',
    label: 'Crayon Drawing',
  },
  {
    value: 'ref:optionKeyName:Pencil',
    label: 'Pencil',
  },
  {
    value: 'ref:optionKeyName:Tattoo Design',
    label: 'Tattoo Design',
  },
  {
    value: 'ref:optionKeyName:Waifu',
    label: 'Waifu',
  },
  {
    value: 'ref:optionKeyName:YuGiOh Art',
    label: 'YuGiOh Art',
  },
  {
    value: 'ref:optionKeyName:Traditional Japanese',
    label: 'Traditional Japanese',
  },
  {
    value: 'ref:optionKeyName:Nihonga Painting',
    label: 'Nihonga Painting',
  },
  {
    value: 'ref:optionKeyName:Claymation',
    label: 'Claymation',
  },
  {
    value: 'ref:optionKeyName:Furry - Painted',
    label: 'Furry - Painted',
  },
  {
    value: 'ref:optionKeyName:Furry - Drawn',
    label: 'Furry - Drawn',
  },
  {
    value: 'ref:optionKeyName:Furry - Cinematic',
    label: 'Furry - Cinematic',
  },
  {
    value: 'ref:optionKeyName:Cartoon',
    label: 'Cartoon',
  },
  {
    value: 'ref:optionKeyName:Cursed Photo',
    label: 'Cursed Photo',
  },
  {
    value: 'ref:optionKeyName:Developed by 9gin',
    label: 'Developed by 9gin',
  },
  {
    value: 'ref:optionKeyName:MTG Card',
    label: 'MTG Card',
  },
  {
    value: 'ref:optionKeyName:Jester',
    label: 'Jester',
  },
  {
    value: 'ref:optionKeyName:Ninja',
    label: 'Ninja',
  },
  {
    value: 'ref:optionKeyName:Random Girl 1',
    label: 'Random Girl 1',
  },
  {
    value: 'ref:optionKeyName:Random Girl 2',
    label: 'Random Girl 2',
  },
  {
    value: 'ref:optionKeyName:Lego',
    label: 'Lego',
  },
  {
    value: 'ref:optionKeyName:Skittles',
    label: 'Skittles',
  },
  {
    value: 'ref:optionKeyName:Webcore',
    label: 'Webcore',
  },
  {
    value: 'ref:optionKeyName:Terraria',
    label: 'Terraria',
  },
  {
    value: 'ref:optionKeyName:Final Fantasy',
    label: 'Final Fantasy',
  },
  {
    value: 'ref:optionKeyName:Star Wars Character',
    label: 'Star Wars Character',
  },
  {
    value: 'ref:optionKeyName:Star Wars Battle',
    label: 'Star Wars Battle',
  },
  {
    value: 'ref:optionKeyName:Dragonball',
    label: 'Dragonball',
  },
  {
    value: 'ref:optionKeyName:Undertale?',
    label: 'Undertale?',
  },
  {
    value: 'ref:optionKeyName:ENA',
    label: 'ENA',
  },
  {
    value: 'ref:optionKeyName:Neko (Catgirl)',
    label: 'Neko (Catgirl)',
  },
  {
    value: 'ref:optionKeyName:American Girl',
    label: 'American Girl',
  },
  {
    value: 'ref:optionKeyName:𝐍𝐒𝐅𝐖 - 𝐑𝐞𝐚𝐥𝐢𝐬𝐭𝐢𝐜',
    label: '𝐍𝐒𝐅𝐖 - 𝐑𝐞𝐚𝐥𝐢𝐬𝐭𝐢𝐜',
  },
  {
    value: 'ref:optionKeyName:𝐍𝐒𝐅𝐖 - 𝐀𝐧𝐢𝐦𝐞',
    label: '𝐍𝐒𝐅𝐖 - 𝐀𝐧𝐢𝐦𝐞',
  },
  {
    value: 'ref:optionKeyName:𝐍𝐒𝐅𝐖 - 𝐑𝐞𝐚𝐥𝐢𝐬𝐭𝐢𝐜 (Stronger)',
    label: '𝐍𝐒𝐅𝐖 - 𝐑𝐞𝐚𝐥𝐢𝐬𝐭𝐢𝐜 (Stronger)',
  },
  {
    value: 'ref:optionKeyName:𝐍𝐒𝐅𝐖 - 𝐀𝐧𝐢𝐦𝐞 (Stronger)',
    label: '𝐍𝐒𝐅𝐖 - 𝐀𝐧𝐢𝐦𝐞 (Stronger)',
  },
  {
    value: 'ref:optionKeyName:NSFW Painted Anime',
    label: 'NSFW Painted Anime',
  },
  {
    value: 'ref:optionKeyName:Realistic Human Generator',
    label: 'Realistic Human Generator',
  },
];
