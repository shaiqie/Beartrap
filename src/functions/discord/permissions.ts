import { PermissionFlagsBits, type GuildMember, type Role } from "discord.js";

export function canBotManageRole(botMember: GuildMember, role: Role): boolean {
  if (role.managed) return false;
  if (role.id === role.guild.roles.everyone.id) return false;
  return botMember.roles.highest.comparePositionTo(role) > 0;
}

export function getRemovableIdentityRoleIds(
  target: GuildMember,
  botMember: GuildMember,
  quarantineRoleId: string
): string[] {
  return target.roles.cache
    .filter((role) => role.id !== quarantineRoleId)
    .filter((role) => role.id !== target.guild.roles.everyone.id)
    .filter((role) => canBotManageRole(botMember, role))
    .map((role) => role.id);
}

export function requiredBotPermissions(): bigint[] {
  return [
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.ReadMessageHistory
  ];
}
