import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  RoleSelectMenuBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  type APIEmbedField,
  type ChatInputCommandInteraction,
  type Guild,
  type ModalSubmitInteraction
} from "discord.js";
import { baseEmbed, successEmbed } from "../../../functions/discord/embeds";
import type { BeartrapComponentInteraction, CommandModule } from "../../../types/Command";
import type { GuildConfig } from "../../../types/Security";

const SETUP_PREFIX = "beartrap:setup";
const SNOWFLAKE_PATTERN = /^\d{17,22}$/;

const command: CommandModule = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Configure Beartrap for this server.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("init")
        .setDescription("Start Beartrap setup.")
        .addBooleanOption((option) =>
          option
            .setName("auto")
            .setDescription("Automatically create default Beartrap roles and channels.")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("logs")
        .setDescription("Set the Beartrap admin log channel.")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("Admin log text channel.")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("quarantine")
        .setDescription("Set quarantine role and category.")
        .addRoleOption((option) =>
          option.setName("role").setDescription("Role applied to contained members.").setRequired(true)
        )
        .addChannelOption((option) =>
          option
            .setName("category")
            .setDescription("Private category for tar-pit channels.")
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("ghosts")
        .setDescription("Set ghost category and channel count.")
        .addChannelOption((option) =>
          option
            .setName("category")
            .setDescription("Category that holds ghost channels.")
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName("count")
            .setDescription("How many ghost channels to keep active.")
            .setMinValue(1)
            .setMaxValue(12)
            .setRequired(false)
        )
        .addBooleanOption((option) =>
          option.setName("rotate").setDescription("Rotate existing ghost channel names.").setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("bait-add-user")
        .setDescription("Add a bait user target.")
        .addUserOption((option) =>
          option.setName("user").setDescription("User account acting as bait.").setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("bait-add-webhook")
        .setDescription("Add a bait webhook ID.")
        .addStringOption((option) =>
          option
            .setName("id")
            .setDescription("Webhook ID to track as bait.")
            .setMinLength(17)
            .setMaxLength(22)
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) => subcommand.setName("bait-list").setDescription("List bait targets."))
    .addSubcommand((subcommand) => subcommand.setName("status").setDescription("Review Beartrap setup."))
    .addSubcommand((subcommand) => subcommand.setName("reset").setDescription("Reset Beartrap guild config.")),

  async execute(interaction, ctx) {
    if (!(await ensureSetupInteraction(interaction))) return;

    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild;
    if (!guild) return;

    if (subcommand === "init") {
      if (interaction.options.getBoolean("auto") === true) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const result = await ctx.services.ghostNetwork.ensureDefaultInfrastructure(guild, interaction.user.id);
        await interaction.editReply({
          embeds: [
            successEmbed(
              "Beartrap wired",
              `Created defaults and armed ${result.ghostChannelIds.length} ghost channel(s).`
            ).addFields(configFields(result.config))
          ]
        });
        return;
      }

      ctx.services.guildConfig.getOrCreateGuildConfig(guild.id);
      await interaction.reply(ephemeral(setupPanelPayload(guild)));
      return;
    }

    if (subcommand === "logs") {
      const channel = interaction.options.getChannel("channel", true);
      const config = ctx.services.guildConfig.updateGuildConfig(guild.id, {
        adminLogChannelId: channel.id,
        enabled: true
      });
      await interaction.reply(ephemeral(savedPayload("Admin log channel saved.", config)));
      return;
    }

    if (subcommand === "quarantine") {
      const role = interaction.options.getRole("role", true);
      const category = interaction.options.getChannel("category", true);
      const config = ctx.services.guildConfig.updateGuildConfig(guild.id, {
        quarantineRoleId: role.id,
        quarantineCategoryId: category.id,
        enabled: true
      });
      await interaction.reply(ephemeral(savedPayload("Quarantine settings saved.", config)));
      return;
    }

    if (subcommand === "ghosts") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const category = interaction.options.getChannel("category", true);
      const count = interaction.options.getInteger("count") ?? 3;
      const rotate = interaction.options.getBoolean("rotate") ?? false;
      const config = ctx.services.guildConfig.updateGuildConfig(guild.id, {
        ghostCategoryId: category.id,
        ghostCount: count,
        enabled: true
      });
      const channels = await ctx.services.ghostNetwork.ensureGhostChannels(guild, config);
      const rotated = rotate ? await ctx.services.ghostNetwork.rotateGhostNames(guild, config) : 0;

      await interaction.editReply({
        embeds: [
          successEmbed(
            "Ghost network synced",
            `Active ghost channels: ${channels.length}${rotated > 0 ? `, rotated: ${rotated}` : ""}.`
          ).addFields(configFields(config))
        ]
      });
      return;
    }

    if (subcommand === "bait-add-user") {
      const user = interaction.options.getUser("user", true);
      ctx.services.guildConfig.addBaitTarget(guild.id, "user", user.id);
      await interaction.reply({
        embeds: [successEmbed("Bait user saved", `<@${user.id}> is now tracked as bait.`)],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (subcommand === "bait-add-webhook") {
      const webhookId = interaction.options.getString("id", true).trim();
      if (!SNOWFLAKE_PATTERN.test(webhookId)) {
        await interaction.reply({
          content: "Webhook ID must be a Discord snowflake.",
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      ctx.services.guildConfig.addBaitTarget(guild.id, "webhook", webhookId);
      await interaction.reply({
        embeds: [successEmbed("Bait webhook saved", `Webhook \`${webhookId}\` is now tracked as bait.`)],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (subcommand === "bait-list") {
      const targets = ctx.services.guildConfig.listBaitTargets(guild.id);
      await interaction.reply({
        embeds: [
          baseEmbed(
            "Beartrap bait targets",
            targets.length === 0
              ? "No bait targets configured."
              : targets.map((target) => `- ${target.targetType}: \`${target.targetId}\``).join("\n")
          )
        ],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (subcommand === "status") {
      const config = ctx.services.guildConfig.getOrCreateGuildConfig(guild.id);
      await interaction.reply(ephemeral(configPayload(config)));
      return;
    }

    if (subcommand === "reset") {
      ctx.services.guildConfig.resetGuild(guild.id);
      await interaction.reply({
        embeds: [successEmbed("Beartrap reset", "Guild config and Beartrap state were cleared.")],
        flags: MessageFlags.Ephemeral
      });
    }
  },

  async handleComponent(interaction, ctx) {
    if (!interaction.customId.startsWith(SETUP_PREFIX)) return false;
    if (!(await ensureSetupInteraction(interaction))) return true;

    const guild = interaction.guild;
    if (!guild) return true;

    if (interaction.isButton()) {
      const action = interaction.customId.slice(`${SETUP_PREFIX}:`.length);

      if (action === "auto") {
        await interaction.deferUpdate();
        const result = await ctx.services.ghostNetwork.ensureDefaultInfrastructure(guild, interaction.user.id);
        await interaction.editReply({
          embeds: [
            successEmbed(
              "Beartrap wired",
              `Created defaults and armed ${result.ghostChannelIds.length} ghost channel(s).`
            ).addFields(configFields(result.config))
          ],
          components: []
        });
        return true;
      }

      if (action === "manual") {
        await interaction.update(manualSetupPayload());
        return true;
      }

      if (action === "review") {
        const config = ctx.services.guildConfig.getOrCreateGuildConfig(guild.id);
        await interaction.update(configPayload(config, false));
        return true;
      }

      if (action === "settings") {
        await interaction.showModal(settingsModal());
        return true;
      }

      if (action === "bait-users") {
        await interaction.update(baitUserPayload());
        return true;
      }

      if (action === "back-manual") {
        await interaction.update(manualSetupPayload());
        return true;
      }
    }

    if (interaction.isChannelSelectMenu()) {
      const selected = firstValue(interaction.values);
      if (!selected) return true;

      await interaction.deferUpdate();
      const action = interaction.customId.slice(`${SETUP_PREFIX}:`.length);
      let config: GuildConfig;

      if (action === "log-channel") {
        config = ctx.services.guildConfig.updateGuildConfig(guild.id, {
          adminLogChannelId: selected,
          enabled: true
        });
      } else if (action === "quarantine-category") {
        config = ctx.services.guildConfig.updateGuildConfig(guild.id, {
          quarantineCategoryId: selected,
          enabled: true
        });
      } else if (action === "ghost-category") {
        config = ctx.services.guildConfig.updateGuildConfig(guild.id, {
          ghostCategoryId: selected,
          enabled: true
        });
        await ctx.services.ghostNetwork.ensureGhostChannels(guild, config);
      } else {
        return true;
      }

      await interaction.editReply(savedPayload("Setting saved.", config, false));
      return true;
    }

    if (interaction.isRoleSelectMenu()) {
      const selected = firstValue(interaction.values);
      if (!selected) return true;

      await interaction.deferUpdate();
      const config = ctx.services.guildConfig.updateGuildConfig(guild.id, {
        quarantineRoleId: selected,
        enabled: true
      });
      await interaction.editReply(savedPayload("Quarantine role saved.", config, false));
      return true;
    }

    if (interaction.isUserSelectMenu()) {
      await interaction.deferUpdate();
      for (const userId of interaction.values) {
        ctx.services.guildConfig.addBaitTarget(guild.id, "user", userId);
      }
      const config = ctx.services.guildConfig.getOrCreateGuildConfig(guild.id);
      await interaction.editReply(savedPayload(`Saved ${interaction.values.length} bait user(s).`, config, false));
      return true;
    }

    if (interaction.isModalSubmit()) {
      await handleSettingsModal(interaction, guild, ctx);
      return true;
    }

    return true;
  }
};

async function ensureSetupInteraction(
  interaction: ChatInputCommandInteraction | BeartrapComponentInteraction
): Promise<boolean> {
  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.reply({
      content: "Beartrap setup only works inside a server.",
      flags: MessageFlags.Ephemeral
    });
    return false;
  }

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({
      content: "Beartrap setup requires `Manage Server`.",
      flags: MessageFlags.Ephemeral
    });
    return false;
  }

  return true;
}

function setupPanelPayload(guild: Guild) {
  return {
    embeds: [
      baseEmbed(
        "Hey there, I'm Beartrap",
        "I help catch suspicious automation quietly, log useful evidence, and keep normal members out of the crossfire. Let's wire the traps."
      ).addFields({ name: "Server", value: guild.name, inline: true })
    ],
    components: setupButtons()
  };
}

function manualSetupPayload() {
  return {
    embeds: [
      baseEmbed("Beartrap manual setup", "Pick server objects directly. Use advanced settings for webhook IDs and ghost count.")
    ],
    components: [
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId(`${SETUP_PREFIX}:log-channel`)
          .setPlaceholder("Admin log channel")
          .setChannelTypes(ChannelType.GuildText)
          .setMinValues(1)
          .setMaxValues(1)
      ),
      new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId(`${SETUP_PREFIX}:quarantine-role`)
          .setPlaceholder("Quarantine role")
          .setMinValues(1)
          .setMaxValues(1)
      ),
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId(`${SETUP_PREFIX}:quarantine-category`)
          .setPlaceholder("Quarantine category")
          .setChannelTypes(ChannelType.GuildCategory)
          .setMinValues(1)
          .setMaxValues(1)
      ),
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId(`${SETUP_PREFIX}:ghost-category`)
          .setPlaceholder("Ghost category")
          .setChannelTypes(ChannelType.GuildCategory)
          .setMinValues(1)
          .setMaxValues(1)
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`${SETUP_PREFIX}:bait-users`)
          .setLabel("Bait users")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`${SETUP_PREFIX}:settings`)
          .setLabel("Webhook/count")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`${SETUP_PREFIX}:review`)
          .setLabel("Review")
          .setStyle(ButtonStyle.Secondary)
      )
    ]
  };
}

function baitUserPayload() {
  return {
    embeds: [baseEmbed("Beartrap bait users", "Select account bait targets. New joins that rush these targets get scored hard.")],
    components: [
      new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
        new UserSelectMenuBuilder()
          .setCustomId(`${SETUP_PREFIX}:bait-users-select`)
          .setPlaceholder("Bait user accounts")
          .setMinValues(1)
          .setMaxValues(10)
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`${SETUP_PREFIX}:back-manual`)
          .setLabel("Back")
          .setStyle(ButtonStyle.Secondary)
      )
    ]
  };
}

function settingsModal(): ModalBuilder {
  const ghostCount = new TextInputBuilder()
    .setCustomId("ghost_count")
    .setLabel("Ghost channel count")
    .setStyle(TextInputStyle.Short)
    .setMinLength(1)
    .setMaxLength(2)
    .setRequired(false)
    .setPlaceholder("3");

  const webhookIds = new TextInputBuilder()
    .setCustomId("webhook_ids")
    .setLabel("Webhook IDs")
    .setStyle(TextInputStyle.Paragraph)
    .setMinLength(0)
    .setMaxLength(500)
    .setRequired(false)
    .setPlaceholder("One or more IDs, separated by spaces or commas.");

  return new ModalBuilder()
    .setCustomId(`${SETUP_PREFIX}:settings-modal`)
    .setTitle("Beartrap settings")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(ghostCount),
      new ActionRowBuilder<TextInputBuilder>().addComponents(webhookIds)
    );
}

async function handleSettingsModal(
  interaction: ModalSubmitInteraction,
  guild: Guild,
  ctx: Parameters<NonNullable<CommandModule["handleComponent"]>>[1]
): Promise<void> {
  const ghostRaw = interaction.fields.getTextInputValue("ghost_count").trim();
  const webhookRaw = interaction.fields.getTextInputValue("webhook_ids").trim();
  const patch: { ghostCount?: number; enabled: boolean } = { enabled: true };

  if (ghostRaw.length > 0) {
    const parsed = Number.parseInt(ghostRaw, 10);
    if (!Number.isNaN(parsed)) patch.ghostCount = parsed;
  }

  const config = ctx.services.guildConfig.updateGuildConfig(guild.id, patch);

  const webhookIds = webhookRaw
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter((value) => SNOWFLAKE_PATTERN.test(value));

  for (const webhookId of webhookIds) {
    ctx.services.guildConfig.addBaitTarget(guild.id, "webhook", webhookId);
  }

  if (config.ghostCategoryId) {
    await ctx.services.ghostNetwork.ensureGhostChannels(guild, config);
  }

  await interaction.reply({
    embeds: [
      successEmbed(
        "Advanced settings saved",
        `Ghost count: ${config.ghostCount}. Webhook bait IDs added: ${webhookIds.length}.`
      ).addFields(configFields(config))
    ],
    flags: MessageFlags.Ephemeral
  });
}

function savedPayload(message: string, config: GuildConfig, includeComponents = true) {
  return {
    embeds: [successEmbed("Saved", message).addFields(configFields(config))],
    components: includeComponents ? setupButtons() : []
  };
}

function configPayload(config: GuildConfig, includeComponents = true) {
  return {
    embeds: [baseEmbed("Beartrap config", config.enabled ? "Security is enabled." : "Security is not enabled yet.").addFields(configFields(config))],
    components: includeComponents ? setupButtons() : []
  };
}

function setupButtons(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`${SETUP_PREFIX}:auto`)
        .setLabel("Auto-create")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`${SETUP_PREFIX}:manual`)
        .setLabel("Manual setup")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`${SETUP_PREFIX}:review`)
        .setLabel("Review config")
        .setStyle(ButtonStyle.Secondary)
    )
  ];
}

function ephemeral<T extends object>(payload: T): T & { flags: MessageFlags.Ephemeral } {
  return {
    ...payload,
    flags: MessageFlags.Ephemeral
  };
}

function configFields(config: GuildConfig): APIEmbedField[] {
  return [
    { name: "Enabled", value: config.enabled ? "yes" : "no", inline: true },
    { name: "Log channel", value: mentionChannel(config.adminLogChannelId), inline: true },
    { name: "Quarantine role", value: mentionRole(config.quarantineRoleId), inline: true },
    { name: "Quarantine category", value: mentionChannel(config.quarantineCategoryId), inline: true },
    { name: "Ghost category", value: mentionChannel(config.ghostCategoryId), inline: true },
    { name: "Ghost count", value: String(config.ghostCount), inline: true }
  ];
}

function mentionChannel(id: string | null): string {
  return id ? `<#${id}>` : "not set";
}

function mentionRole(id: string | null): string {
  return id ? `<@&${id}>` : "not set";
}

function firstValue(values: readonly string[]): string | null {
  return values[0] ?? null;
}

export default command;
