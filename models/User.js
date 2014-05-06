var keystone = require('keystone'),
	async = require('async'),
	Types = keystone.Field.Types;

/**
 * Users Model
 * ===========
 */

var User = new keystone.List('User', {
	autokey: { path: 'key', from: 'name', unique: true }
});

var deps = {
	github: { 'services.github.isConfigured': true },
	google: { 'services.google.isConfigured': true },
	twitter: { 'services.twitter.isConfigured': true }
}

User.add({
	name: { type: Types.Name, required: true, index: true },
	email: { type: Types.Email, initial: true, index: true },
	password: { type: Types.Password, initial: true },
	state: { type: Types.Select, options: 'enabled, banned' },
	notes: { type: Types.Textarea, collapse: true },
	resetPasswordKey: { type: String, hidden: true }
}, 'Profile', {
	isPublic: Boolean,
	photo: { type: Types.CloudinaryImage },
	github: { type: String, width: 'short' },
	twitter: { type: String, width: 'short' },
	website: { type: Types.Url },
	bio: { type: Types.Markdown },
	joinedAt: { type: Date, default: Date.now },
}, 'Notifications', {
	notifications: {
		topics: { type: Boolean, default: true }
	}
}, 'Permissions', {
	isAdmin: { type: Boolean, label: 'Can Admin KeystoneJS Forum' }
}, 'Services', {
	services: {
		github: {
			isConfigured: { type: Boolean, label: 'GitHub has been authenticated' },
			
			profileId: { type: String, label: 'Profile ID', dependsOn: deps.github },
			profileUrl: { type: String, label: 'Profile URL', dependsOn: deps.github },
			
			username: { type: String, label: 'Username', dependsOn: deps.github },
			accessToken: { type: String, label: 'Access Token', dependsOn: deps.github },
			refreshToken: { type: String, label: 'Refresh Token', dependsOn: deps.github }
		},
		google: {
			isConfigured: { type: Boolean, label: 'Google has been authenticated' },
			
			profileId: { type: String, label: 'Profile ID', dependsOn: deps.google },
			
			username: { type: String, label: 'Username', dependsOn: deps.google },
			accessToken: { type: String, label: 'Access Token', dependsOn: deps.google },
			refreshToken: { type: String, label: 'Refresh Token', dependsOn: deps.google }
		},
		twitter: {
			isConfigured: { type: Boolean, label: 'Twitter has been authenticated' },
			
			profileId: { type: String, label: 'Profile ID', dependsOn: deps.twitter },
			
			username: { type: String, label: 'Username', dependsOn: deps.twitter },
			accessToken: { type: String, label: 'Access Token', dependsOn: deps.twitter },
			refreshToken: { type: String, label: 'Refresh Token', dependsOn: deps.twitter }
		}
	}
});

/** Meta */

User.add('Meta', {
	createdAt: { type: Date, default: Date.now, noedit: true, index: true },
	topicCount: { type: Number, default: 0, collapse: true, noedit: true },
	replyCount: { type: Number, default: 0, collapse: true, noedit: true }
});


/**
	Relationships
	=============
*/

User.relationship({ path: 'watchedTopics', ref: 'Topic', refPath: 'watchedBy' });
User.relationship({ path: 'authoredTopics', ref: 'Topic', refPath: 'author' });
User.relationship({ path: 'authoredReplies', ref: 'Reply', refPath: 'author' });


/**
 * Virtuals
 * ========
 */

// Provide access to Keystone
User.schema.virtual('canAccessKeystone').get(function() {
	return this.isAdmin;
});

User.schema.virtual('url').get(function() {
	return '/profile/' + this.key;
});


/** 
	Methods
	=======
*/

User.schema.methods.wasActive = function() {
	this.lastActiveOn = new Date();
	return this;
}

User.schema.methods.resetPassword = function(callback) {
	
	var user = this;
	
	this.resetPasswordKey = keystone.utils.randomString([16,24]);
	
	this.save(function(err) {
		
		if (err) return callback(err);
		
		new keystone.Email('forgotten-password').send({
			name: user.name.first || user.name.full,
			link: 'http://forum.keystonejs.com/reset-password/' + user.resetPasswordKey,
			subject: 'Reset your KeystoneJS Forum Password'
		},{
			to: user,
			from: {
				name: 'KeystoneJS Forum',
				email: 'contact@keystonejs.com'
			}
		}, callback);
		
	});
	
}

User.schema.pre('save', function(next) {
	
	var user = this;
	
	this.wasNew = this.isNew;
	
	async.parallel([
		
		// cache the count of topics to this user
		function(done) {
			keystone.list('Topic').model.count().where('author', user.id).where('state', 'published').exec(function(err, count) {
				user.topicCount = count || 0;
				done(err);
			});
		},
		
		// cache the count of replies to this user
		function(done) {
			keystone.list('Reply').model.count().where('author', user.id).where('state', 'published').exec(function(err, count) {
				user.replyCount = count || 0;
				done(err);
			});
		}
		
	], next);
	
});


/**
 * Registration
 * ============
*/

User.defaultColumns = 'name, email, isAdmin';
User.register();