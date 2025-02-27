import {Client, GuildMember, MessageEmbedOptions, TextChannel} from 'discord.js'
import {shouldCountForStats, tierRoleId} from './levelling.js'
import {config} from '../Config.js'
import {xpForLevel, xpForMessage} from './experienceCalculations.js'
import {DDUser, getUserById} from '../store/models/DDUser.js'
import {EventHandler} from '../EventHandler.js'
import {createStandardEmbed} from '../util/embeds.js'
import {mention, mentionWithNoPingMessage, pseudoMention} from '../util/users.js'
import {modifyRoles} from '../util/roles.js'
import {logger} from '../logging.js'

const xpHandler: EventHandler = (client) => {
	client.on('messageCreate', async msg => {
		if (!(msg.channel instanceof TextChannel)) {
			return
		}
		if(msg.guild == null) {
			return
		}
		if (await shouldCountForStats(msg.author, msg, msg.channel, config)) {
			const xp = xpForMessage(msg.content)
			const user = await getUserById(BigInt(msg.author.id))
			if (!user) {

				logger.error(`Could not find or create user with id ${msg.author.id}`)
				return
			}
			user.xp += xp
			await levelUp(client, await msg.guild.members.fetch(msg.author), user)
			await user.save()
			logger.info(`Gave ${xp} XP to user ${user.id} for message ${msg.id}`)
		}
	})
}

const levelUp = async (client: Client, user: GuildMember, ddUser: DDUser) => {
	let level = ddUser.level
	while (xpForLevel(level) <= ddUser.xp) {
		level++
	}
	if (level == ddUser.level) {
		return
	}
	ddUser.level = level
	await applyTierRoles(client, user, ddUser)
	await sendLevelUpMessage(client, user, ddUser)
}

const applyTierRoles = async (client: Client, user: GuildMember, ddUser: DDUser) => {
	const tier = tierRoleId(ddUser.level)
	await modifyRoles(client, user, {
		toAdd: [tier],
		toRemove: config.roles.tiers.filter(it => it != tier)
	})
}

const sendLevelUpMessage = async (client: Client, member: GuildMember, ddUser: DDUser) => {
	const user = member.user
	const channel = await client.channels.fetch(config.channels.botCommands) as TextChannel
	if (!channel) {
		console.error(`Could not find level up channel with id ${config.channels.botCommands}`)
		return
	}
	const embed = {
		...createStandardEmbed(member),
		title: '⚡ Level Up!',
		author: {
			name: pseudoMention(user),
			iconURL: user.avatarURL()
		},
		fields: [
			{
				name: '📈 XP',
				value: `${ddUser.xp}/${xpForLevel(ddUser.level + 1)}`
			}],
		description: `${mention(member)}, you leveled up to level **${ddUser.level}**!`
	} as MessageEmbedOptions
	const message = mentionWithNoPingMessage(member)
	await channel.send({content: message, embeds: [embed]})
}

export default xpHandler