// TODO placeholder bug
// TODO image size

import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "normalize.css";

import emojiData from "@emoji-mart/data";
import EmojiPicker from "@emoji-mart/react";
import {
  ActionIcon,
  AppShell,
  Button,
  Center,
  CopyButton,
  createTheme,
  Group,
  MantineProvider,
  Paper,
  Popover,
  ScrollArea,
  SegmentedControl,
  Slider,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import {
  IconArrowsHorizontal,
  IconArrowsVertical,
  IconCheck,
  IconCirclePlus,
  IconClipboard,
  IconGripVertical,
  IconPhotoDown,
  IconRepeat,
  IconTrashX,
} from "@tabler/icons-react";
import _ from "lodash";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type OnDragEndResponder,
} from "react-beautiful-dnd";
import removeAccents from "remove-accents";
import { z } from "zod";

const StyleSchema = z.object({
  letter: z.string(),
  background: z.string(),
});

type Style = z.infer<typeof StyleSchema>;

function createRandomStyle(): Style {
  const coolCategories = emojiData.categories.filter((category) =>
    ["nature", "foods", "people"].includes(category.id)
  );

  const category1 = _.sample(coolCategories)!;

  const otherCategories = coolCategories.filter(
    (category) => category.id != category1.id
  );

  const category2 = _.sample(otherCategories)!;

  function pick(category) {
    const emojiId = _.sample(category.emojis);
    const emoji = emojiData.emojis[_.sample(category.emojis)];

    return emoji.skins[0].native;
  }

  return {
    letter: pick(category1),
    background: pick(category2),
  };
}

const OptionsSchema = z.object({
  direction: z.union([z.literal("vertical"), z.literal("horizontal")]),
  horizontalPadding: z.number(),
  verticalPadding: z.number(),
  spaceSize: z.number(),
  fillSpacesWith: z.union([z.literal("background"), z.literal("nothing")]),
  applyStylesOn: z.union([z.literal("letter"), z.literal("word")]),
});

type Options = z.infer<typeof OptionsSchema>;

export function createDefaultOptions(): Options {
  return {
    direction: "vertical",
    horizontalPadding: 1,
    verticalPadding: 1,
    spaceSize: 2,
    fillSpacesWith: "background",
    applyStylesOn: "letter",
  };
}

const theme = createTheme({});

const DEBUG_IMAGE_RENDERING = false;

const stateSchema = z.object({
  inputText: z.string(),
  styles: z.array(StyleSchema),
  options: OptionsSchema,
  outputText: z.string(),
});

export function App() {
  type State = z.infer<typeof stateSchema>;

  const [state, setState] = useState<State>(() => {
    const inputText = "abcdefghijklmnopqrstubvwxyz0123456789";

    const styles = [{ letter: "🌻", background: "🌿" }];

    const options = createDefaultOptions();

    const outputText = toEmoji(inputText, styles, options);

    return { inputText, styles, options, outputText };
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem("TextToEmojiEditor");

      if (stored) {
        const deserialized = stateSchema.safeParse(JSON.parse(stored));

        if (deserialized.error) {
          throw new Error(deserialized.error.message);
        }

        // TODO setState(deserialized.data);
        setState({
          ...deserialized.data,
          outputText: toEmoji(
            deserialized.data.inputText,
            deserialized.data.styles,
            deserialized.data.options
          ),
        });
      }
    } catch (error) {
      console.error("Cannot load data", error);
    }
  }, []);

  const updateState = useCallback((updater: (oldState: State) => State) => {
    setState((oldState) => {
      const newState = updater(oldState);

      localStorage.setItem("TextToEmojiEditor", JSON.stringify(newState));

      return newState;
    });
  }, []);

  const updateInputText = useCallback(
    (text: string) => {
      updateState((oldState) => ({
        ...oldState,
        inputText: text,
        outputText: toEmoji(text, oldState.styles, oldState.options),
      }));
    },
    [updateState]
  );

  const updateOptions = useCallback(
    (diff: Partial<Options>) => {
      updateState((oldState) => {
        const newOptions = { ...oldState.options, ...diff };

        return {
          ...oldState,
          options: newOptions,
          outputText: toEmoji(oldState.inputText, oldState.styles, newOptions),
        };
      });
    },
    [updateState]
  );

  const addStyle = useCallback(() => {
    updateState((oldState) => {
      const newStyles = [...oldState.styles, createRandomStyle()];

      return {
        ...oldState,
        styles: newStyles,
        outputText: toEmoji(oldState.inputText, newStyles, oldState.options),
      };
    });
  }, [updateState]);

  const removeStyle = useCallback(
    (index: number) => {
      updateState((oldState) => {
        const newStyles = oldState.styles.toSpliced(index, 1);

        return {
          ...oldState,
          styles: oldState.styles.toSpliced(index, 1),
          outputText: toEmoji(oldState.inputText, newStyles, oldState.options),
        };
      });
    },
    [updateState]
  );

  const changeStyle = useCallback(
    (index: number, target: keyof Style, emoji: string) => {
      updateState((oldState) => {
        const newStyles = _.cloneDeep(oldState.styles);
        newStyles[index][target] = emoji;

        return {
          ...oldState,
          styles: newStyles,
          outputText: toEmoji(oldState.inputText, newStyles, oldState.options),
        };
      });
    },
    [updateState]
  );

  const dragStyle = useCallback<OnDragEndResponder>(
    (data) => {
      const { source, destination } = data;

      if (destination) {
        updateState((oldState) => {
          const newStyles = [...oldState.styles];
          const [removed] = newStyles.splice(source.index, 1);
          newStyles.splice(destination.index, 0, removed);

          return {
            ...oldState,
            styles: newStyles,
            outputText: toEmoji(
              oldState.inputText,
              newStyles,
              oldState.options
            ),
          };
        });
      }
    },
    [updateState]
  );

  const titleEmoji = useMemo(() => _.sample(FRUIT_EMOJIS), []);

  const canvasDebugRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback((renderedEmojis: string) => {
    // Use the debug canvas or a temporary canvas

    const canvas = DEBUG_IMAGE_RENDERING
      ? canvasDebugRef.current
      : document.createElement("canvas");

    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    // Measure the emoji sizes to size the canvas accordingly

    const fontSize = 100;
    ctx.font = `${fontSize}px Arial`;
    ctx.textBaseline = "middle";

    const usedCharacters = _.uniq(
      Array.from(
        new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
          renderedEmojis
        ),
        ({ segment }) => segment
      )
    );

    let maxEmojiWidth = -Infinity,
      maxEmojiHeight = -Infinity;

    usedCharacters.forEach((emoji) => {
      const size = ctx.measureText(emoji);

      maxEmojiWidth = Math.max(maxEmojiWidth, size.width);

      maxEmojiHeight = Math.max(
        maxEmojiHeight,
        size.actualBoundingBoxAscent + size.actualBoundingBoxDescent
      );
    });

    const rows = renderedEmojis.split("\n");
    const oneRow = rows[0];

    canvas.width = maxEmojiWidth * oneRow.length;
    canvas.height = maxEmojiHeight * rows.length;

    // Render each row

    ctx.font = `${fontSize}px Arial`;
    ctx.textBaseline = "middle";

    renderedEmojis.split("\n").forEach((row, rowIndex) => {
      ctx.fillText(row, 0, (rowIndex + 0.5) * maxEmojiHeight);
    });

    // Download the image

    if (!DEBUG_IMAGE_RENDERING) {
      const downloadElement = document.createElement("a");
      downloadElement.download = "emoji-text.png";
      downloadElement.href = canvas.toDataURL();
      downloadElement.click();
    }
  }, []);

  return (
    <MantineProvider theme={theme}>
      <Notifications />

      <AppShell
        header={{ height: 60 }}
        navbar={{
          width: 300,
          breakpoint: "sm",
        }}
        padding="md"
      >
        <AppShell.Header>
          <Group h="100%" gap={0}>
            <Title order={4} w={300} pl={10}>
              {titleEmoji} Text → Emoji
            </Title>

            <TextInput
              pr={10}
              style={{ flexGrow: 1 }}
              placeholder="Your message here"
              value={state.inputText}
              onChange={(event) => updateInputText(event.target.value)}
            />
          </Group>
        </AppShell.Header>

        <AppShell.Navbar p="md">
          <Stack align="stretch" style={{ height: "100%" }}>
            <Stack gap="0.25rem">
              <SmallText value="Direction" />
              <SegmentedControl
                data={[
                  {
                    label: (
                      <Center>
                        <IconArrowsVertical />
                      </Center>
                    ),
                    value: "vertical",
                  },
                  {
                    label: (
                      <Center>
                        <IconArrowsHorizontal />
                      </Center>
                    ),
                    value: "horizontal",
                  },
                ]}
                value={state.options.direction}
                onChange={(value) =>
                  updateOptions({
                    direction:
                      value == "horizontal" ? "horizontal" : "vertical",
                  })
                }
              />
            </Stack>

            <OptionsSlider
              target="horizontalPadding"
              label="Horizontal padding"
              options={state.options}
              onUpdateOptions={updateOptions}
            />

            <OptionsSlider
              target="verticalPadding"
              label="Vertical padding"
              options={state.options}
              onUpdateOptions={updateOptions}
            />

            <OptionsSlider
              target="spaceSize"
              label="Space size"
              min={1}
              options={state.options}
              onUpdateOptions={updateOptions}
            />

            <Stack gap="0.25rem">
              <Group justify="space-between">
                <SmallText value="Styles" />

                <ActionIcon size="sm" variant="subtle" onClick={addStyle}>
                  <IconCirclePlus />
                </ActionIcon>
              </Group>

              <Paper withBorder radius="sm" p="md">
                <DragDropContext onDragEnd={dragStyle}>
                  <Droppable droppableId="droppable">
                    {(provided) => (
                      <Stack
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        p={0}
                      >
                        {state.styles.map((style, styleIndex) => (
                          <StyleChip
                            key={styleIndex}
                            index={styleIndex}
                            style={style}
                            onChange={(target, emoji) =>
                              changeStyle(styleIndex, target, emoji)
                            }
                            onRemove={
                              state.styles.length > 1
                                ? () => removeStyle(styleIndex)
                                : undefined
                            }
                          />
                        ))}

                        {provided.placeholder}
                      </Stack>
                    )}
                  </Droppable>
                </DragDropContext>
              </Paper>
            </Stack>

            <Stack gap="0.25rem">
              <SmallText value="Apply styles on" />
              <SegmentedControl
                data={[
                  {
                    label: (
                      <Center>
                        <Group gap="0.2rem">
                          <Group gap={0}>
                            <Text span c="grape" fw={500}>
                              E
                            </Text>
                            <Text span c="lime" fw={500}>
                              a
                            </Text>
                            <Text span c="grape" fw={500}>
                              c
                            </Text>
                            <Text span c="lime" fw={500}>
                              h
                            </Text>
                          </Group>

                          <Group gap={0}>
                            <Text span c="grape" fw={500}>
                              l
                            </Text>
                            <Text span c="lime" fw={500}>
                              e
                            </Text>
                            <Text span c="grape" fw={500}>
                              t
                            </Text>
                            <Text span c="lime" fw={500}>
                              t
                            </Text>
                            <Text span c="grape" fw={500}>
                              e
                            </Text>
                            <Text span c="lime" fw={500}>
                              r
                            </Text>
                          </Group>
                        </Group>
                      </Center>
                    ),
                    value: "letter",
                  },
                  {
                    label: (
                      <Center>
                        <Group gap="0.2rem">
                          <Text span c="grape" fw={500}>
                            Each
                          </Text>
                          <Text span c="lime" fw={500}>
                            word
                          </Text>
                        </Group>
                      </Center>
                    ),
                    value: "word",
                  },
                ]}
                value={state.options.applyStylesOn}
                onChange={(value) =>
                  updateOptions({
                    applyStylesOn: value == "letter" ? "letter" : "word",
                  })
                }
              />
            </Stack>

            <Stack gap="0.25rem">
              <SmallText value="Fill spaces with" />

              <SegmentedControl
                data={[
                  {
                    label: "Background",
                    value: "background",
                  },
                  {
                    label: "Nothing",
                    value: "nothing",
                  },
                ]}
                value={state.options.fillSpacesWith}
                onChange={(value) =>
                  updateOptions({
                    fillSpacesWith:
                      value == "background" ? "background" : "nothing",
                  })
                }
              />
            </Stack>

            <Stack
              gap={"0.5rem"}
              style={{ flexGrow: 1, justifyContent: "flex-end" }}
            >
              <CopyButton value={state.outputText}>
                {({ copied, copy }) => (
                  <Button
                    variant={copied ? "filled" : "gradient"}
                    color={"teal"}
                    leftSection={copied ? <IconCheck /> : <IconClipboard />}
                    onClick={copy}
                  >
                    {copied ? "Copied" : "Copy"} to clipboard
                  </Button>
                )}
              </CopyButton>

              <Button
                leftSection={<IconPhotoDown />}
                variant="gradient"
                onClick={() => draw(state.outputText)}
              >
                Download image
              </Button>
            </Stack>
          </Stack>
        </AppShell.Navbar>

        <AppShell.Main>
          {DEBUG_IMAGE_RENDERING && (
            <canvas
              ref={canvasDebugRef}
              style={{ position: "absolute" }}
            ></canvas>
          )}

          <Center
            p="20"
            h={state.options.direction == "horizontal" ? "100vh" : undefined}
          >
            <ScrollArea
              type="auto"
              style={{ whiteSpace: "pre", textWrap: "nowrap" }}
            >
              {state.outputText}
            </ScrollArea>
          </Center>
        </AppShell.Main>
      </AppShell>
    </MantineProvider>
  );
}

function SmallText(props: { value: string }) {
  return (
    <Text size="sm" c="dimmed">
      {props.value}
    </Text>
  );
}

function OptionsSlider(props: {
  target: "horizontalPadding" | "verticalPadding" | "spaceSize";
  label: string;
  min?: number;
  max?: number;
  options: Options;
  onUpdateOptions: (diff: Partial<Options>) => void;
}) {
  return (
    <Stack gap="0.25rem">
      <SmallText value={props.label} />

      <Slider
        min={props.min ?? 0}
        max={props.max ?? 10}
        step={1}
        value={props.options[props.target]}
        onChange={(value) => props.onUpdateOptions({ [props.target]: value })}
      />
    </Stack>
  );
}

function StyleChip(props: {
  index: number;
  style: Style;
  onChange: (target: keyof Style, emoji: string) => void;
  onRemove?: () => void;
}) {
  const [showPickerFor, setShowPickerFor] = useState<keyof Style>();

  return (
    <Draggable
      key={props.index}
      draggableId={props.index.toString()}
      index={props.index}
    >
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          style={{
            ...provided.draggableProps.style,
          }}
        >
          <Paper shadow="xs" p="xs">
            <Group justify="space-between">
              <Center {...provided.dragHandleProps}>
                <Tooltip label="Move" withArrow>
                  <IconGripVertical style={{ width: "1rem" }} />
                </Tooltip>
              </Center>

              <Group gap={5}>
                <Popover
                  opened={showPickerFor == "letter"}
                  onChange={() => setShowPickerFor(undefined)}
                >
                  <Popover.Target>
                    <Tooltip label="Letter" withArrow>
                      <span
                        style={{ cursor: "pointer" }}
                        onClick={() => setShowPickerFor("letter")}
                      >
                        {props.style.letter}
                      </span>
                    </Tooltip>
                  </Popover.Target>

                  <Popover.Dropdown>
                    <EmojiPicker
                      data={emojiData}
                      onEmojiSelect={(value) =>
                        props.onChange("letter", value.native)
                      }
                    />
                  </Popover.Dropdown>
                </Popover>
                /
                <Popover
                  opened={showPickerFor == "background"}
                  onChange={() => setShowPickerFor(undefined)}
                >
                  <Popover.Target>
                    <Tooltip label="Background" withArrow>
                      <span
                        style={{ cursor: "pointer" }}
                        onClick={() => setShowPickerFor("background")}
                      >
                        {props.style.background}
                      </span>
                    </Tooltip>
                  </Popover.Target>

                  <Popover.Dropdown>
                    <EmojiPicker
                      data={emojiData}
                      onEmojiSelect={(value) =>
                        props.onChange("background", value.native)
                      }
                    />
                  </Popover.Dropdown>
                </Popover>
              </Group>

              <Group gap="xs">
                <Tooltip label="Swap" withArrow>
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color="gray"
                    onClick={() => {
                      props.onChange("letter", props.style.background);
                      props.onChange("background", props.style.letter);
                    }}
                  >
                    <IconRepeat />
                  </ActionIcon>
                </Tooltip>

                {props.onRemove && (
                  <Tooltip label="Delete" withArrow>
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      color="gray"
                      onClick={props.onRemove}
                    >
                      <IconTrashX />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
            </Group>
          </Paper>
        </div>
      )}
    </Draggable>
  );
}

<>
  <Text span c="red">
    E
  </Text>
  <Text span c="teal">
    a
  </Text>
  <Text span c="lime">
    c
  </Text>
  <Text span c="red">
    h
  </Text>
</>;

export function toEmoji(
  text: string,
  styles: Style[],
  options: Options
): string {
  // Clean up the input text
  // - to lowercase
  // - remove accents
  // - remove unsupported characters

  const letters = text
    .toLowerCase()
    .split("")
    .map(removeAccents)
    .filter((letter) => letter.match(/[0-9a-z\s]/) != null);

  // Sort consecutive letters/spaces into blocks

  type Block =
    | { type: "word"; letters: string[] }
    | { type: "spaces"; length: number };

  const blocks = letters.reduce<Block[]>((blocks, letter) => {
    const lastBlock = _.last(blocks);

    if (letter == " ") {
      if (lastBlock?.type == "spaces") {
        ++lastBlock.length;
      } else {
        blocks.push({ type: "spaces", length: 1 });
      }
    } else {
      if (lastBlock?.type == "word") {
        lastBlock.letters.push(letter);
      } else {
        blocks.push({ type: "word", letters: [letter] });
      }
    }

    return blocks;
  }, []);

  // Split the blocks into styled blocks depending

  type StyledBlock =
    | { type: "word"; letters: string[]; style: Style }
    | { type: "spaces"; length: number; style: Style | undefined };

  let styleIndex = 0;

  const styledBlocks = blocks.flatMap<StyledBlock>((block) => {
    if (block.type == "spaces") {
      return [
        {
          ...block,
          style:
            options.fillSpacesWith == "background"
              ? styles[styleIndex++ % styles.length]
              : undefined,
        },
      ];
    } else if (options.applyStylesOn == "word") {
      return [{ ...block, style: styles[styleIndex++ % styles.length] }];
    } else {
      return block.letters.map((letter) => ({
        type: "word",
        letters: [letter],
        style: styles[styleIndex++ % styles.length],
      }));
    }
  });

  // Render each letter as a string

  const renderedLetters = styledBlocks.flatMap((styledBlock) => {
    let blockTemplates: string[] = [];

    if (styledBlock.type == "spaces") {
      if (options.direction == "vertical") {
        if (styledBlock.style) {
          blockTemplates = [
            Array(styledBlock.length * options.spaceSize)
              .fill("0".repeat(LETTER_WIDTH + options.horizontalPadding * 2))
              .join("\n"),
          ];
        } else {
          blockTemplates = [
            "\n".repeat(
              Math.max(0, styledBlock.length * options.spaceSize - 1)
            ),
          ];
        }
      } else {
        if (styledBlock.style) {
          blockTemplates = [
            Array(LETTER_HEIGHT + options.verticalPadding * 2)
              .fill("0".repeat(styledBlock.length * options.spaceSize))
              .join("\n"),
          ];
        } else {
          blockTemplates = [
            Array(LETTER_HEIGHT + options.verticalPadding * 2)
              .fill("\t".repeat(styledBlock.length * options.spaceSize))
              .join("\n"),
          ];
        }
      }
    } else {
      blockTemplates = styledBlock.letters.map((letter) => {
        const template = LETTER_TEMPLATES[letter];

        // Horizontal padding: add background symbols at the left and right of each row

        const horizontalPadding = "0".repeat(options.horizontalPadding);

        let outputTemplate = template
          .split("\n")
          .map((row) => `${horizontalPadding}${row}${horizontalPadding}`)
          .join("\n");

        // Vertical padding: add rows of background symbols at the top and bottom of the letter

        const verticalPadding = Array(options.verticalPadding)
          .fill("0".repeat(LETTER_WIDTH + options.horizontalPadding * 2))
          .join("\n");

        const verticalPaddingTop = verticalPadding
          ? `${verticalPadding}\n`
          : "";
        const verticalPaddingBottom = verticalPadding
          ? `\n${verticalPadding}`
          : "";

        outputTemplate = `${verticalPaddingTop}${outputTemplate}${verticalPaddingBottom}`;

        return outputTemplate;
      });
    }

    // Replace the background/letter symbols with the style's emojis

    return blockTemplates.map((blockTemplate) =>
      styledBlock.style
        ? blockTemplate
            .replaceAll("0", styledBlock.style.background)
            .replaceAll("1", styledBlock.style.letter)
        : blockTemplate
    );
  });

  let assembledLetters: string;

  // Vertical
  if (options.direction == "vertical") {
    // Concatenate all the letters with spacing
    assembledLetters = renderedLetters.join("\n");
  }

  // Horizontal
  else {
    assembledLetters = renderedLetters
      // Split each letter into rows
      .map((letter) => letter.split("\n"))
      // Merge all the rows at the same level into a long-long row
      .reduce(
        (assembledRows, letterRows) =>
          _.zip(assembledRows, letterRows).map(
            ([assembledRow, letterRow]) => `${assembledRow}${letterRow}`
          ),
        Array(LETTER_HEIGHT + options.verticalPadding * 2).fill("")
      )
      // Join all the long-long rows together
      .join("\n");
  }

  return assembledLetters;
}

const LETTER_WIDTH = 5;
const LETTER_HEIGHT = 6;

const LETTER_TEMPLATES: Record<string, string> = {
  a: `01110
10001
10001
11111
10001
10001`,
  b: `11110
10001
11110
10001
10001
11110`,
  c: `01110
10001
10000
10000
10001
01110`,
  d: `11100
10010
10001
10001
10010
11100`,
  e: `11110
10000
11100
10000
10000
11110`,
  f: `11110
10000
11100
10000
10000
10000`,
  g: `01110
10000
10000
10011
10001
01110`,
  h: `10001
10001
11111
10001
10001
10001`,
  i: `01110
00100
00100
00100
00100
01110`,
  j: `00111
00010
00010
00010
10010
01100`,
  k: `10010
10100
11000
11000
10100
10010`,
  l: `10000
10000
10000
10000
10000
11110`,
  m: `10001
11011
10101
10001
10001
10001`,
  n: `10001
11001
10101
10011
10001
10001`,
  o: `01110
10001
10001
10001
10001
01110`,
  p: `11110
10001
10001
11110
10000
10000`,
  q: `01110
10001
10001
10101
10010
01101`,
  r: `11110
10001
10001
11110
10010
10001`,
  s: `00111
01000
00110
00001
00001
01110`,
  t: `11111
00100
00100
00100
00100
00100`,
  u: `10001
10001
10001
10001
10001
01110`,
  v: `10001
10001
10001
10001
01010
00100`,
  w: `10001
10001
10001
10101
11011
10001`,
  x: `10001
01010
00100
00100
01010
10001`,
  y: `10001
01010
00100
00100
00100
00100`,
  z: `11111
00010
00100
01000
10000
11111`,
  "0": `01110
10001
10001
10001
10001
01110`,
  "1": `00100
01100
00100
00100
00100
01110`,
  "2": `01110
10001
00010
00100
01000
11111`,
  "3": `01110
10001
00001
00010
10001
01110`,
  "4": `00010
00110
01010
11111
00010
00010`,
  "5": `11111
10000
11110
00001
00001
11110`,
  "6": `01110
10000
11110
10001
10001
01110`,
  "7": `11111
00001
00010
00100
01000
01000`,
  "8": `01110
10001
01110
10001
10001
01110`,
  "9": `00110
01001
00111
00001
01001
00110`,
};

const FRUIT_EMOJIS = [
  "🍇",
  "🍈",
  "🍉",
  "🍊",
  "🍋",
  "🍋‍🟩",
  "🍌",
  "🍍",
  "🥭",
  "🍐",
  "🍑",
  "🍒",
  "🍓",
  "🫐",
  "🥝",
  "🥥",
];
