import { nodeVisualNamespace } from "../domain/node-visual";

export const tebModdleDescriptor = {
  name: "TheExperienceBlogs",
  uri: nodeVisualNamespace,
  prefix: "teb",
  xml: { tagAlias: "lowerCase" },
  types: [
    {
      name: "NodeVisual",
      superClass: ["Element"],
      properties: [
        {
          name: "iconKey",
          type: "String",
          isAttr: true,
        },
      ],
    },
  ],
} as const;
