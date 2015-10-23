$(function () {
    var MINE_NEUTRAL = 0x6c6c6c;
    var MINE_A = 0xFF6666;
    var MINE_B = 0x6666FF;

    function truncRadians(r) {
        while (r < 0) {
            r += Math.PI * 2;
        }
        return r;
    }

    function getRotation(p1, p2) {
        //
        var vec = {x: p2.x - p1.x, y: p2.y - p1.y};
        var rot = truncRadians(Math.atan2(vec.y, vec.x)); // - (Math.PI / 2));
        return rot;
    }

    var MatchState = function () {
        this.roundNumber = 0;
        this.research = {a: {}, b: {}};
        this.power = {a: 0, b: 0};
        this.robots = {};
        this.encampments = {};
        this.mines = {a: {}, b: {}, neutral: {}};
        this.delta = [];
    };

    MatchState.prototype.hasDefusion = function (team) {
        var val = this.research[team].DEFUSION;
        return val >= 25;
    };

    var Match = function () {
        this.states = [];
        this.matchNumber = 0;
        this.mapWidth = 0;
        this.mapHeight = 0;
        this.mapName = null;
        this.winner = null;
    };

    var Game = function () {
        EventEmitter.call(this);
        this.matches = [];
        this.teams = {};
        this.isLoaded = false;
        this.isLoading = false;
    };

    Game.prototype = new EventEmitter;

    Game.prototype.doMatchHeader = function (node) {

        var $map = $("map", node);
        var map = $map.text().trim();
        map = map.split("\n");
        this.currentMatch = new Match();
        this.currentMatch.matchNumber = parseInt($(node).attr('matchNumber'));
        this.currentMatch.matchCount = parseInt($(node).attr('matchCount'))
        this.currentMatch.mapWidth = map[0].length;
        this.currentMatch.mapHeight = map.length;
    };

    Game.prototype.parseLoc = function (locStr) {
        var parts = locStr.split(",");
        var x = parseInt(parts[0]);
        var y = parseInt(parts[1]);
        return (y*this.currentMatch.mapWidth) + x;
    };

    Game.prototype.doMatchFooter = function (node) {
        this.currentMatch.winner = $(node).attr("winner").toLowerCase();

        var wins = {a: 0, b: 0};
        for (var i=0; i<this.matches.length; i++) {
            wins[this.matches[i].winner] ++;
        }
        this.currentMatch.wins = wins;
        this.matches.push(this.currentMatch);

    };

    Game.prototype.doMatchMetadata = function (node) {
        this.teams.a = {name: $(node).attr('team-a')};
        this.teams.b = {name: $(node).attr('team-b')};
        this.currentMatch.mapName = $(node).attr("maps").split(",")[this.currentMatch.matchNumber];
    };

    Game.prototype.handleEncampment = function (node, state) {
        var locKey = this.parseLoc($(node).attr("location"));
        state.delta.push({event: 'addEncampmentSquare', location: locKey});
        state.encampments[locKey] = true;
    };

    Game.prototype.handleIndicatorString = function (node, state) {
        var rId = $(node).attr("robotID");
        var sId = $(node).attr("stringIndex");
        state.robots[rId].indicatorStrings[sId] = $(node).attr("newString");
    };

    Game.prototype.handleMine = function (node, state) {
        var team = $(node).attr('mineTeam').toLowerCase();
        var birth = $(node).attr('birth');
        var mineVal = MINE_NEUTRAL;
        var loc = $(node).attr("mineLoc").split(",");
        var x = parseInt(loc[0]);
        var y = parseInt(loc[1]);

        if (x < 0 || y < 0 || x >= this.currentMatch.mapWidth || y >= this.currentMatch.mapHeight) {
            return;
        }

        loc = (y * this.currentMatch.mapWidth) + x;

        if (birth == 'true') {
            if (state.mines.a[loc] || state.mines.b[loc] || state.mines.neutral[loc]) {
                return;
            }
            mineList = state.mines[team];
            mineList[loc] = true;
            state.delta.push({event: 'mineBirth', team: team, location: loc});
        } else {
            if (state.mines.a[loc]) {
                delete state.mines.a[loc];
                team = 'a';
            } else if (state.mines.b[loc]) {
                delete state.mines.b[loc];
                team = 'b';
            } else if (state.mines.neutral[loc]) {
                delete state.mines.neutral[loc];
                team = 'neutral';
            }
            state.delta.push({event: 'mineDeath', team: team, location: loc});
        }
    };

    Game.prototype.handleSpawn = function (node, state) {
        var loc = $(node).attr('loc').split(",");
        var type = $(node).attr('type');
        var rId = parseInt($(node).attr('robotID'));
        var team = $(node).attr('team');
        var parentID = $(node).attr("parentID");

        var bot = {
            team: team.toLowerCase(),
            type: type.toLowerCase(),
            pos: {x: parseInt(loc[0]), y: parseInt(loc[1])},
            dir: 0,
            shields: 0,
            action: null,
            actionRounds: null,
            attacking: {},
            id: rId,
            indicatorStrings: {0: "", 1: "", 2: ""}
        };

        bot.energon = 100;
        if (bot.type == 'soldier') {
            bot.energon = 40;
            bot.dir = getRotation(state.robots[parentID].pos, bot.pos);
        } else if (bot.type == 'hq') {
            bot.energon = 500;
        }
        bot.maxEnergon = bot.energon;
        state.robots[rId] = bot;
        state.delta.push({event: 'spawn', bot: bot});
    };

    Game.prototype.handleMove = function (node, state) {
        var robotId = $(node).attr('robotID');
        var bot = state.robots[robotId];

        var newLoc = $(node).attr("newLoc").split(",");
        newLoc = {x: parseInt(newLoc[0]), y: parseInt(newLoc[1])};

        bot.dir = getRotation(bot.pos, newLoc);
        state.delta.push({event: 'move', botId: bot.id, from: bot.pos, to: newLoc, dir: bot.dir});
        bot.pos = newLoc;
    };

    Game.prototype.handleDeath = function (node, state) {
        var robotId = $(node).attr('objectID');
        state.robots[robotId].energon = 0;
        state.robots[robotId].isDead = true;
        state.delta.push({event: 'death', bot: state.robots[robotId]});
        this.toDie.push(robotId);
    };

    Game.prototype.handleAttack = function (node, state) {
        var bot = state.robots[$(node).attr("robotID")];
        var srcLoc = bot.pos;
        var destLoc = $(node).attr("targetLoc").split(",");
        destLoc = {x: parseInt(destLoc[0]), y: parseInt(destLoc[1])};
        var loc = this.parseLoc($(node).attr("targetLoc"));
        bot.attacking[loc] = true;
        state.delta.push({event: 'attack', botId: bot.id, target: loc});
    };

    Game.prototype.handleBytecodesUsed = function (node, state) {
        var botIds = $(node).attr("robotIDs").split(",");
        var bot;
        if (botIds[0] != '') {
            var values = $(node).attr("numBytecodes").split(',');
            for (var i=0; i<values.length; i++) {
                bot = state.robots[botIds[i]].bytecodesUsed = values[i];
            }
        }
    };

    Game.prototype.handleResearch = function (node, state) {
        var team = $(node).attr("team").toLowerCase();
        var upgrade = $('upgrade', node).text();

        if (!state.research[team][upgrade]) {
            state.research[team][upgrade] = 1;
        } else {
            state.research[team][upgrade] ++;
        }
        var delta = {event: "research", upgrade: upgrade, value: state.research[team][upgrade], team: team};
        state.delta.push(delta);
    };

    Game.prototype.handleMineLayer = function (node, state) {
        var bot = state.robots[$(node).attr("robotID")];
        var isLaying = $(node).attr("isLaying") == "true";
        var mineLoc = $(node).attr("targetLoc").split(",");
        mineLoc = {x: mineLoc[0], y: mineLoc[1]};
        var delta = {botId: bot.id, loc: mineLoc};
        if (isLaying) {
            bot.action = "layingMine";
            bot.actionRounds = 25;
            delta.event = 'layMine';
        } else {
            delta.event = 'defuseMine';
            bot.action = "defusingMine";
            bot.actionRounds = state.hasDefusion(bot.team) ? 5 : 12;
            bot.dir = getRotation(bot.pos, mineLoc);
            delta.dir = bot.dir;
        }

        bot.actionRoundsTotal = bot.actionRounds;
        state.delta.push(delta);
    };

    Game.prototype.handleEnergonChange = function (node, state) {
        var botKeys = $(node).attr("robotIDs").split(",");
        var delta = {event: 'energonChange', values: {}};
        if (botKeys[0] != "") {
            var values = $(node).attr("energon").split(",");
            var val;
            for (var i = 0; i < values.length; i++) {
                val = parseFloat(values[i]);
                state.robots[botKeys[i]].energon = val;
                delta.values[botKeys[i]] = val;
            }
        }
    };

    Game.prototype.handleTeamPowerChange = function (node, state) {
        var values = $(node).attr('flux').split(',');
        state.power.a = parseFloat(values[0]);
        state.power.b = parseFloat(values[1]);
        state.delta.push({event: 'teamPowerChange', power: state.power});
    };

    Game.prototype.handleShieldsChange = function (node, state) {
        var botKeys = $(node).attr('robotIDs').split(',');
        var delta = {event: 'shieldsChange', values: {}};
        if (botKeys[0] != "") {
            var values = $(node).attr('shield').split(',');
            var val;
            for (var i = 0; i < values.length; i++) {
                val = parseFloat(values[i]);
                state.robots[botKeys[i]].shields = val;
                delta.values[botKeys[i]] = val;
            }
        }
    };

    Game.prototype.handleRegen = function (node, state) {
        var rId = $(node).attr("robotID");
        state.delta.push({event: 'regen', loc: state.robots[rId].pos});
    };

    Game.prototype.handleShield = function (node, state) {
        var rId = $(node).attr("robotID");
        state.delta.push({event: 'shield', loc: state.robots[rId].pos});
    };

    Game.prototype.handleCapture = function (node, state) {
        var rId = $(node).attr("parentID");
        var loc = $(node).attr("loc").split(",");
        var bot = state.robots[rId];
        bot.action = 'capturing';
        bot.actionRounds = 50;
        bot.actionRoundsTotal = 50;
    };

    Game.prototype.doRoundDelta = function (node) {
        var state;


        if (this.currentMatch.states.length == 0) {
            state = new MatchState();
            this.toDie = [];
        } else {
            state = $.extend(true, new MatchState(), this.currentMatch.states[this.currentMatch.states.length-1]);
            state.delta = [];

            var actionDelta = {event: 'actionDelta', bots: {}};
            var bot;

            for (var bk in state.robots) {
                bot = state.robots[bk];
                if (this.toDie.indexOf(bk) != -1) {
                    state.delta.push({event: "removeDead", bot: state.robots[bk]});
                    delete state.robots[bk];
                    continue;
                }
                bot.attacking = {};
                if (bot.actionRounds > 0) {
                    bot.actionRounds -= 1;
                    if (bot.actionRounds == 0) {
                        bot.action = null;
                    }
                    actionDelta.bots[bk] = {'action': bot.action, 'actionRounds': bot.actionRounds};
                }
            }
            this.toDie = [];
        }

        this.currentMatch.states.push(state);

        var nodes = $(node).children();
        for (var i=0; i<nodes.length; i++) {
            node = nodes[i];
            if (node.tagName == 'sig.NodeBirthSignal') {
                this.handleEncampment(node, state);
            } else if (node.tagName == 'sig.MineSignal') {
                this.handleMine(node, state);
            } else if (node.tagName == 'sig.SpawnSignal') {
                this.handleSpawn(node, state);
            } else if (node.tagName == 'sig.MovementSignal') {
                this.handleMove(node, state);
            } else if (node.tagName == 'sig.DeathSignal') {
                this.handleDeath(node, state);
            } else if (node.tagName == 'sig.AttackSignal') {
                this.handleAttack(node, state);
            } else if (node.tagName == 'sig.MinelayerSignal') {
                this.handleMineLayer(node, state);
            } else if (node.tagName == 'sig.EnergonChangeSignal') {
                this.handleEnergonChange(node, state);
            } else if (node.tagName == 'sig.ShieldChangeSignal') {
                this.handleShieldsChange(node, state);
            } else if (node.tagName == 'sig.FluxChangeSignal') {
                this.handleTeamPowerChange(node, state);
            } else if (node.tagName == 'sig.IndicatorStringSignal') {
                this.handleIndicatorString(node, state);
            } else if (node.tagName == 'sig.BytecodesUsedSignal') {
                this.handleBytecodesUsed(node, state);
            } else if (node.tagName == 'sig.RegenSignal') {
                this.handleRegen(node, state);
            } else if (node.tagName == 'sig.ShieldSignal') {
                this.handleShield(node, state);
            } else if (node.tagName == 'sig.CaptureSignal') {
                this.handleCapture(node, state);
            } else if (node.tagName == 'sig.ResearchSignal') {
                this.handleResearch(node, state);
            }
        }
    };

    Game.prototype.downloadProgressHandler = function (ev) {
        var value = (ev.loaded / ev.total) * 10;
        this.emit('loadProgress', value);
    };

    Game.prototype.processChildren = function (children, total) {
        var startedAt = new Date().getTime();
        var node;
        while (children.length > 0 && new Date().getTime() < startedAt + 50) {
            node = children.shift();
            if (node.tagName == 'ser.MatchHeader') {
                this.doMatchHeader(node);
            } else if (node.tagName == 'ser.MatchFooter') {
                this.doMatchFooter(node);
            } else if (node.tagName == 'ser.ExtensibleMetadata') {
                this.doMatchMetadata(node);
            } else if (node.tagName == 'ser.RoundDelta') {
                this.doRoundDelta(node);
            }
        }
        if (children.length == 0) {
            this.isLoaded = true;
            this.emit('loadComplete');
        } else {
            this.emit('loadProgress', 10 + (((total-children.length) / total) * 90));
            setTimeout(function () {
                this.processChildren(children, total);
            }.bind(this), 1);
        }
    };

    Game.prototype.loadGzipped = function (data) {
        var arr = new Uint8Array(data);
        console.log("read " + arr.length + " bytes.");
        var gz = new Zlib.Gunzip(arr);
        var contents = gz.decompress();
        var s = new TextDecoder("ascii").decode(contents);
        console.log(s.length + " bytes uncompressed");
        var $xml = $($.parseXML(s));
        var children = $.makeArray($($xml.children()[0]).children());
        console.log("Processing " + children.length + " events");
        this.processChildren(children, children.length);
    };

    Game.prototype.loadFile = function (fileInput) {
        var file = fileInput.files[0];
        var reader = new FileReader();
        reader.onload = function (f) {
            var arr = new Uint8Array(f.target.result);
            this.loadGzipped(arr);
        }.bind(this);
        reader.readAsArrayBuffer(file);
    };

    Game.prototype.loadUrl = function (url) {
        console.log("Loading match from " + url);
        this.isLoading = true;
        this.emit('loadStart');

        $.ajax({
            type: 'GET',
            url: url,
            dataType: 'binary',
            processData: false,
            responseType:'arraybuffer',
            xhr: function () {
                var xhr = new window.XMLHttpRequest();
                xhr.addEventListener("progress", this.downloadProgressHandler.bind(this));
                return xhr;
            }.bind(this),

            success: this.loadGzipped.bind(this)
        });

    };

    window.MatchState = MatchState;
    window.Match = Match;
    window.Game = Game;
});
