$(function () {

    var MINE_NEUTRAL = 0x6c6c6c;
    var MINE_A = 0xFF6666;
    var MINE_B = 0x6666FF;
    var FRAME_DURATION = 1000;

    var bk, i;

    var Player = function (container) {
        this.assetsLoaded = false;
        this.container = $(container);
        this.container.empty();
        this.game = null;
        this.paused = true;
        this.frameDuration = FRAME_DURATION;
        this.canvasContainer = $("<div id='canvasContainer'></div>");
        this.stage = new PIXI.Container();
        this.field = new PIXI.Graphics();
        this.botLayer = new PIXI.Container(); //new PIXI.ParticleContainer(10000, {scale: true, position: true, rotation: true, uvs: true});
        this.effectsLayer = new PIXI.Graphics();
        this.statusLayer = new PIXI.Graphics();
        this.statsPanel = new PIXI.Container();
        this.stage.addChild(this.field);
        this.stage.addChild(this.botLayer);
        this.stage.addChild(this.statusLayer);
        this.stage.addChild(this.effectsLayer);
        this.renderer = PIXI.autoDetectRenderer($(this.canvasContainer).width(), $(this.canvasContainer).height(), {antialias: false, transparent: true, autoResize: true});
        this.interactionManager = new PIXI.interaction.InteractionManager(this.renderer, {autoPreventDefault: true});
        this.canvasContainer.append(this.renderer.view);
        $(window).on('resize', '', this.onResize.bind(this));
        this.loadAssets();
    };

    Player.prototype.onAssetsLoaded = function (loader, resources) {
        this.boomFrames = [];
        var texture = resources.boom.texture;
        var frameWidth = 60, frameHeight = 60;
        for(var i = 0; i < texture.width-frameWidth; i+=frameWidth) {
            this.boomFrames.push({texture: new PIXI.Texture(texture.baseTexture, new PIXI.Rectangle(i, 0, frameWidth, frameHeight)), time: 1});
        }
        var rev = [];
        for(var i = 0; i < texture.width-frameWidth; i+=frameWidth) {
            rev.push({texture: new PIXI.Texture(texture.baseTexture, new PIXI.Rectangle(i, 0, frameWidth, frameHeight)), time: 1});
        }
        rev.reverse();
        this.boomFrames = this.boomFrames.concat(rev);
        for (var t in {a: true, b: true}) {
            for (var rt in {soldier: true, hq: true, artillery: true, medbay: true, shields: true, supplier: true, generator: true}) {
                this.textures[t][rt] = new PIXI.Texture(resources[rt + '-' + t].texture);
            }
        }
        this.assetsLoaded = true;

        this.buildHeader();
        this.container.append(this.canvasContainer);
        requestAnimationFrame( this.animate.bind(this) );
    };

    Player.prototype.loadAssets = function () {
        PIXI.loader
            .add("boom", "img/boom.png")
            .add("hq-a", "img/hq-a.png")
            .add("hq-b", "img/hq-b.png")
            .add("soldier-a", "img/soldier-a.png")
            .add("soldier-b", "img/soldier-b.png")
            .add("supplier-a", "img/supplier-a.png")
            .add("supplier-b", "img/supplier-b.png")
            .add("generator-a", "img/generator-a.png")
            .add("generator-b", "img/generator-b.png")
            .add("artillery-a", "img/artillery-a.png")
            .add("artillery-b", "img/artillery-b.png")
            .add("medbay-a", "img/medbay-a.png")
            .add("medbay-b", "img/medbay-b.png")
            .add("shields-a", "img/shields-a.png")
            .add("shields-b", "img/shields-b.png")
            .load(this.onAssetsLoaded.bind(this));
    };

    Player.prototype.onBotClick = function (ev) {
        var bot = ev.target;
        if (bot.selectedBot != bot.id) {
            this.selectBot(bot);

        }
        console.log("Click? ", ev);
    };

    Player.prototype.selectBot = function (bot) {
        bot = this.matchState.robots[bot.id];
        this.selectedBot = bot.id;
        $('.botIcon', this.selectedBotPanel)
            .empty()
            .append("<div class='energonOuter'><div class='energon'></div></div>");

        this.updateSelectedBotPanel();

    };

    Player.prototype.positionStatsPanel = function () {
        var bottomSpace = $(this.canvasContainer).height() - this.boardHeight;
        var rightSpace = $(this.canvasContainer).width() - this.boardWidth;

        if (bottomSpace > rightSpace) {
            console.log("Stats At Bottom!");
            this.statsHorizontal = true;
            this.statsVertical = false;
            var top = this.canvasContainer.offset().top + this.boardHeight;
            this.statsPanel.css({
                'boxSizing': 'border-box',
                left: 0 + "px",
                top: top,
                width: this.boardWidth,
                height: this.canvasContainer.height() - this.boardHeight,
                flexDirection: 'row',
            });
        } else {
            this.statsHorizontal = false;
            this.statsVertical = true;
            console.log("Stats At Side!");
            this.statsPanel.css({
                'boxSizing': 'border-box',
                left: this.canvasContainer.offset().left + this.boardWidth,
                top: this.canvasContainer.offset().top,
                width: this.canvasContainer.width() - this.boardWidth,
                height: this.boardHeight,
                flexDirection: 'column'
            });

        };


        //this.positionStatsPanelChildren(this.statsPanel.children[0]);
        //this.positionStatsPanelChildren(this.statsPanel.children[1]);

    };

    Player.prototype.onResize = function () {
        console.log("Container resized!");
        var newW = $(this.canvasContainer).width();
        var newH = $(this.canvasContainer).height() - 1;
        if (this.renderer && this.renderer.view) {
            console.log("Resizing renderer to " + newW + "x" + newH);
            $(this.renderer.view).width(newW + "px");
            $(this.renderer.view).height(newH + "px");
            this.renderer.resize(newW, newH);
            this.setDimensions();
        }
    };

    Player.prototype.onMatchSelectorChange = function (ev) {
        var val = $(ev.currentTarget).val();
        console.log("Match: val");
        if (!this.paused) {
            this.togglePlayback();
        }
        this.initMatch(this.game.matches[val])
    };

    Player.prototype.onGotoStartButton = function (ev) {
        this.transitionToRound(0);
    };

    Player.prototype.onGotoEndButton = function (ev) {
        this.transitionToRound(this.match.states.length-1);
    };

    Player.prototype.onGoForwardButton = function (ev) {
        this.transitionToRound(Math.min(this.round + 1, this.match.states.length-1));
    };

    Player.prototype.onGoBackButton = function (ev) {
        this.transitionToRound(Math.max(this.round - 1, 0));
    };

    Player.prototype.buildHeader = function () {
        this.header = $("<div id='header'></div>");
        this.matchSelector = $("<select id='matchSelector'></select>");
        this.roundIndicator = $("<div id='roundIndicator'>0/0</div>");
        this.timeSlider = $("<input id='timeSlider' type='range' max='1' value='0' />");
        this.speedSlider = $("<input title='Playback Speed' id='speedSlider' type='range' min='0' max='100' value='70' />");
        this.playPauseButton = $("<button title='Play/Pause' id='playPauseButton' class='paused'><i class='fa fa-play'></i></button>");
        this.gotoEndButton = $("<button title='Go to last round' id='gotoEndButton'><i class='fa fa-fast-forward'></i></button>");
        this.gotoStartButton = $("<button title='Go to first round' id='gotoStartButton'><i class='fa fa-fast-backward'></i></button>");
        this.goForwardButton = $("<button title='Go to next round' id='goForwardButton'><i class='fa fa-forward'></i></button>");
        this.goBackButton = $("<button  title='Go to previous round' id='goBackButton'><i class='fa fa-backward'></i></button>");
        this.speedIndicator= $("<div id='speedIndicator'>75%</div>");
        this.fullscreenButton = $("<button title='Toggle Fullscreen' id='fullscreenButton'><i class='fa fa-arrows-alt'></i></button>");

        this.timeSlider.on('change input', '', this.onTimeSliderChange.bind(this));
        this.gotoStartButton.on('click', this.onGotoStartButton.bind(this));
        this.gotoEndButton.on('click', this.onGotoEndButton.bind(this));
        this.goBackButton.on('click', this.onGoBackButton.bind(this));
        this.goForwardButton.on('click', this.onGoForwardButton.bind(this));
        this.fullscreenButton.on('click', this.onFullscreenButton.bind(this));

        this.header.append(this.matchSelector);
        this.header.append(this.gotoStartButton);
        this.header.append(this.goBackButton);
        this.header.append(this.playPauseButton);
        this.header.append(this.goForwardButton);
        this.header.append(this.gotoEndButton);
        this.header.append(this.timeSlider);
        this.header.append(this.roundIndicator);
        this.header.append(this.speedSlider);
        this.header.append(this.speedIndicator);
        this.header.append(this.fullscreenButton);

        this.matchSelector.on('change', '', this.onMatchSelectorChange.bind(this));
        this.speedSlider.on('change input', '', this.onSpeedSliderChange.bind(this));
        this.speedSlider.change();
        this.playPauseButton.on('click', '', this.togglePlayback.bind(this));
        this.container.append(this.header);
    };

    Player.prototype.onFullscreenButton = function (e) {
        if (Util.isFullscreen()) {
            Util.cancelFullscreen();
        } else {
            Util.makeFullscreen($('body'));
        }
    };

    Player.prototype.onTimeSliderChange = function (e) {
        this.transitionToRound($(e.currentTarget).val());
    };

    Player.prototype.onSpeedSliderChange = function (e) {

        var pct = (this.speedSlider.val()/100.0);
        this.frameDuration = FRAME_DURATION - (FRAME_DURATION * pct);
        console.log("Setting frameDuration to " + this.frameDuration);
        this.speedIndicator.text(this.speedSlider.val() + "%");
        for (i=0; i<this.boomFrames.length; i++) {
            this.boomFrames[i].time = this.frameDuration*2 / this.boomFrames.length;
        }
    };

    Player.prototype.textures = {
        a: {
            //soldier: PIXI.Texture.fromImage("img/soldier-a.png", null, PIXI.SCALE_MODES.NEAREST),
            //supplier: PIXI.Texture.fromImage("img/supplier-a.png", null, PIXI.SCALE_MODES.NEAREST),
            //generator: PIXI.Texture.fromImage("img/generator-a.png", null, PIXI.SCALE_MODES.NEAREST),
            //hq: PIXI.Texture.fromImage("img/hq-a.png", null, PIXI.SCALE_MODES.NEAREST),
            //artillery: PIXI.Texture.fromImage("img/artillery-a.png", null, PIXI.SCALE_MODES.NEAREST),
            //medbay: PIXI.Texture.fromImage("img/medbay-a.png", null, PIXI.SCALE_MODES.NEAREST),
            //shields: PIXI.Texture.fromImage("img/shields-a.png", null, PIXI.SCALE_MODES.NEAREST)
        },
        b: {
            //soldier: PIXI.Texture.fromImage("img/soldier-b.png", null, PIXI.SCALE_MODES.NEAREST),
            //supplier: PIXI.Texture.fromImage("img/supplier-b.png", null, PIXI.SCALE_MODES.NEAREST),
            //generator: PIXI.Texture.fromImage("img/generator-b.png", null, PIXI.SCALE_MODES.NEAREST),
            //hq: PIXI.Texture.fromImage("img/hq-b.png", null, PIXI.SCALE_MODES.NEAREST),
            //artillery: PIXI.Texture.fromImage("img/artillery-b.png", null, PIXI.SCALE_MODES.NEAREST),
            //medbay: PIXI.Texture.fromImage("img/medbay-b.png", null, PIXI.SCALE_MODES.NEAREST),
            //shields: PIXI.Texture.fromImage("img/shields-b.png", null, PIXI.SCALE_MODES.NEAREST)
        }
        
    };

    Player.prototype.artilleryShellConfig = {
        "alpha": {
            "start": 1,
            "end": 0
        },
        "scale": {
            "start": 0.12,
            "end": 0.12,
            "minimumScaleMultiplier": 1
        },
        "color": {
            "start": "#ebac23",
            "end": "#9e3020"
        },
        "speed": {
            "start": 40,
            "end": 50
        },
        "acceleration": {
            "x": 7,
            "y": 7
        },
        "startRotation": {
            "min": 0,
            "max": 360
        },
        "rotationSpeed": {
            "min": 55,
            "max": 0
        },
        "lifetime": {
            "min": 0.251,
            "max": 0.241
        },
        "blendMode": "normal",
        "frequency": 0.008,
        "emitterLifetime": -1,
        "maxParticles": 500,
        "pos": {
            "x": 0,
            "y": 0
        },
        "addAtBack": false,
        "spawnType": "circle",
        "spawnCircle": {
            "x": 0,
            "y": 0,
            "r": 0
        }
    };

    Player.prototype.explosionConfig = {
        "alpha": {
            "start": 0.8,
            "end": 0.7
        },
        "scale": {
            "start": 0.1,
            "end": 0.01,
            "minimumScaleMultiplier": 1.28
        },
        "color": {
            "start": "#e3f9ff",
            "end": "#0ec8f8"
        },
        "speed": {
            "start": 50,
            "end": 50
        },
        "acceleration": {
            "x": 0,
            "y": 0
        },
        "startRotation": {
            "min": 0,
            "max": 0
        },
        "rotationSpeed": {
            "min": 0,
            "max": 0
        },
        "lifetime": {
            "min": 0.8,
            "max": 0.8
        },
        "blendMode": "normal",
        "frequency": 0.2,
        "emitterLifetime": 0.41,
        "maxParticles": 1000,
        "pos": {
            "x": 0,
            "y": 0
        },
        "addAtBack": false,
        "spawnType": "burst",
        "particlesPerWave": 8,
        "particleSpacing": 45,
        "angleStart": 0
    };

    Player.prototype.setDimensions = function () {
        var wPix = (this.canvasContainer.width() / this.match.mapWidth);
        var hPix = (this.canvasContainer.height() / this.match.mapHeight);

        this.cellSize = Math.min(wPix, hPix);
        //console.log("Trying cellsize " + this.cellSize);
        this.boardWidth = (this.cellSize * this.match.mapWidth);
        this.boardHeight = (this.cellSize * this.match.mapHeight);

        var bottomSpace = $(this.canvasContainer).height() - this.boardHeight;
        var rightSpace = $(this.canvasContainer).width() - this.boardWidth;

        if (bottomSpace > rightSpace) {
            while (bottomSpace < 160) {
                this.cellSize-=0.25;
                this.boardWidth = (this.cellSize * this.match.mapWidth);
                this.boardHeight = (this.cellSize * this.match.mapHeight);
                bottomSpace = $(this.canvasContainer).height() - this.boardHeight;
            }
        } else {
            while (rightSpace < 250) {
                this.cellSize -= 0.25;
                this.boardWidth = (this.cellSize * this.match.mapWidth);
                this.boardHeight = (this.cellSize * this.match.mapHeight);
                rightSpace = $(this.canvasContainer).width() - this.boardWidth;
            }
        }
        //this.cellSize = this.cellSize;
        this.botSize = this.cellSize;
        //if (this.botSize < 8) {
        //    this.botSize = 8;
        //} else if (this.botSize < 12) {
        //    this.botSize = 12;
        //} else if (this.botSize < 16) {
        //    this.botSize = 16;
        //}
        //
        //
        this.halfBotSize = this.botSize / 2;
        if (this.matchState) {
            var sprite, bot;
            for (var bk in this.matchState.robots) {
                bot = this.matchState.robots[bk]
                sprite = this.botSprites[bk];
                sprite.width = this.botSize;
                sprite.height = this.botSize;
                TweenLite.killTweensOf(sprite.position);
                sprite.position = this.getCellCenter(bot.pos);
            }
        } if (this.statsPanel) {
            this.positionStatsPanel();
        }
        console.log("Initialized " + this.boardWidth + "x" + this.boardHeight + " canvas and " + this.cellSize + "px cell size");
    };

    Player.prototype.onGameLoadStart = function () {
        console.log("Game Load Start");
        this.loadDialog = $("<div id='loadDialog'><h2>Loading Game</h2><progress></progress></div>");
        $('progress', this.loadDialog).attr("max", 100);
        $('progress', this.loadDialog).attr("value", 0);
        this.loadDialog.css({
            //background: ''
            position: 'absolute',
            top: '45%',
            left: '30%',
            width: '40%'
        });
        $('body').append(this.loadDialog);

    };

    Player.prototype.onGameLoadProgress = function (progress) {
        setTimeout(function () {
            $("progress", this.loadDialog).attr("value", Math.floor(progress));
        }.bind(this), 1);

    };

    Player.prototype.onGameLoadComplete = function (progress) {

        if (this.loadDialog) {
            this.loadDialog.remove();
        }

        this.matchSelector.empty();
        for (var i=0; i<this.game.matches.length; i++) {
            var mapName = this.game.matches[i].mapName;
            if (mapName.substring(mapName.length-4).toLowerCase() == '.xml') {
                mapName = mapName.substring(0, mapName.length-4);
            }
            this.matchSelector.append("<option value='" + i + "'>" + i + ". " + mapName + "</option>");
        }
        this.initMatch(this.game.matches[0]);
    };

    Player.prototype.loadGame = function (game, callback) {

        if (!this.paused) {
            console.log("Toggling");
            this.togglePlayback();
            this.transitionToRound(0);
        }

        if (typeof game == 'string') {
            this.game = new Game();
            this.game.load(game);
        } else {
            this.game = game;
        }
        if (!game.isLoaded) {
            this.game.on('loadStart', this.onGameLoadStart.bind(this));
            this.game.on('loadProgress', this.onGameLoadProgress.bind(this));
            this.game.on('loadComplete', this.onGameLoadComplete.bind(this));
        } else {
            this.onGameLoadComplete();
        }


    };

    Player.prototype.initMatch = function (match) {
        this.match = match;
        this.reset();
        $(window).resize();
        this.renderMap();
        this.timeSlider.val(0);
        this.timeSlider.attr("max", this.match.states.length-1);
        this.transitionToRound(0);
        //var maxRound = this.match.states.length-1;
        //this.roundIndicator.text(Util.zeroPad(0, ("" + maxRound).length) + "/" + maxRound);

    };

    Player.prototype.renderMineList = function (mines) {
        var mine, gx, gy, px, py;
        for (var mine in mines) {
            mine = parseInt(mine);
            gx = mine % this.match.mapWidth;
            gy = Math.floor(mine / this.match.mapWidth);
            px = 1+(this.cellSize * gx);
            py = 1+(this.cellSize* gy);
            this.field.drawRect(px, py, this.cellSize-2, this.cellSize-2);
        }
    };

    Player.prototype.upgrades = {
        FUSION: 25,
        DEFUSION: 25,
        PICKAXE: 25,
        VISION: 25,
        NUKE: 404
    };
    Player.prototype.buildTeamStatsPanel = function (team) {
        var teamInfo = this.game.teams[team];
        var $panel = $("<div class='teamStatsPanel' id='team-stats-"+team+"'></div>");
        $panel.css({flex: 1});
        $panel.append($("<h1 class='team-" + team + "'>" + teamInfo.name + "</h1>"));

        var hqContainer = $("<div style='display: flex; flex-direction: row'></div>");
        var hqIcon = $("<div class='hqIcon team-" + team + "'></div>");
        var hqEnergon = $("<div class='energonOuter'><div class='energon'></div></div>");
        hqIcon.append(hqEnergon);
        hqContainer.append(hqIcon);
        var botCounts = $("<div class='botCounts'></div>");
        var botCountsTbl = $("<table></table>");
        botCountsTbl.append($('<tr><th class="soldier"></th><td class="soldier">0</td><th class="medbay"></th><td class="medbay">0</td><th class="shields"></th><td class="shields">0</td></tr>'));
        botCountsTbl.append($('<tr><th class="supplier"></th><td class="supplier">0</td><th class="generator"></th><td class="generator">0</td><th class="artillery"></th><td class="artillery">0</td></tr>'));
        botCounts.append(botCountsTbl);
        var progressBar = $("<span class='power-value'>0</span><div class='teamPowerWrapper'><div class='teamPower'></div></div>");
        botCounts.append(progressBar);
        hqContainer.append(botCounts);
        $panel.append(hqContainer);
        for (var u in this.upgrades) {
            $panel.append($('<div title="' + u + '" style="display: none" class="upgrade '+ u + '">' +
                    '<img src="img/' + u.toLowerCase() + '.png" />' +
                    '<progress value="0" max="' + this.upgrades[u] + '"></progress>' +
                '</div>'));
        }
        return $panel;
    };

    Player.prototype.buildSelectedBotPanel = function () {
        this.selectedBotPanel = $(
            "<div id='selectedBotPanel'>" +
                "<h1></h1>" +
                "<div class='selectedBotDetailWrap'>" +
                    "<div class='botIcon'></div>" +
                    "<div class='details'></div>" +
                "</div>" +
            "<div class='indicatorStrings'></div>" +
            "</div>");
        return this.selectedBotPanel;
    };

    Player.prototype.initializeStatsPanel = function () {
        $("#statsPanel").remove();
        this.statsPanel = $("<div id='statsPanel'></div>");
        this.statsPanel.css({position: 'absolute', display: 'flex'});
        $('body').append(this.statsPanel);
        this.statsPanel.append(this.buildTeamStatsPanel('a'));
        this.statsPanel.append(this.buildTeamStatsPanel('b'));
        this.statsPanel.append(this.buildSelectedBotPanel());
    };

    Player.prototype.reset = function () {

        this.initializeStatsPanel();
        this.botSprites = {};
        this.selectedBot = null;
        this.matchState = null;
        this.frameTime = 0;
        this.round = -1;
        this.lastElapsed = 0;
        this.playbackComplete = false;
        this.paused = true;
        this.botSprites = {};
        this.botLayer.removeChildren();

        //this.transitionToRound(0);

    };

    Player.prototype.togglePlayback = function () {
        if (!this.assetsLoaded) {
            // TODO: They pressed play before
            // textures were loaded.
            return;
        }
        this.paused = !this.paused;
        $("i.fa", this.playPauseButton)
            .removeClass('fa-play fa-pause')
            .addClass(this.paused ? 'fa-play' : 'fa-pause');
    };

    Player.prototype.parseLoc = function (locStr) {
        var parts = locStr.split(",");
        var x = parseInt(parts[0]);
        var y = parseInt(parts[1]);
        return (y*this.match.mapWidth) + x;
    };

    Player.prototype.transitionToRound = function (round) {

        if (round > this.match.states.length-1) {
            return;
        }
        this.effectsLayer.clear();
        var currentRound = this.round;
        var newState = null;
        if (round == currentRound) {
            //TODO: No-op?
        } else if (round > currentRound) {
            // Go Forward.
            for (var i=currentRound+1; i<=round; i++) {
                //console.log("Applying state " + this.round + " -> " + i);
                this.round = i;
                this.matchState = this.match.states[this.round];
                this.applyMatchState(this.matchState, round == i);
            }
        } else {
            // Go backwards.
            for (var i=currentRound-1; i>=round; i--) {
                //console.log("Undoing state " + this.round + " -> " + i);
                this.undoMatchState(this.matchState, round == i);
                this.round = i;
                this.matchState = this.match.states[this.round];
            }
        }
        $("#timeSlider").val(this.round);
        var maxRound = this.match.states.length-1;
        this.roundIndicator.text(Util.zeroPad(this.round, ("" + maxRound).length) + "/" + maxRound);
        this.updateStatsPanel();
        this.renderMap();

    };

    Player.prototype.updateStatsPanel = function () {
        var counts = {a: {hq: 0, soldier: 0, artillery: 0, generator: 0, shields: 0, medbay: 0, supplier: 0},
                       b: {hq: 0, soldier: 0, artillery: 0, generator: 0, shields: 0, medbay: 0, supplier: 0}};
        var bot;
        var hq = {a: null, b: null};
        for (var bk in this.matchState.robots) {
            bot = this.matchState.robots[bk];
            counts[bot.team][bot.type] ++;
            if (bot.type == 'hq') {
                hq[bot.team] = bot;
            }
        }


        for (team in {a: true, b: true}) {

            var panel = $("#team-stats-" + team);

            var wins = this.match.wins[team];
            if (this.round == this.match.states.length-1 && this.match.winner == team) {
                wins += 1;
            }
            $("h1 i", panel).remove();
            for (i=0; i<wins; i++) {

                $("h1", panel).append("<i class='fa fa-star'></i>");
            }

            //TODO don't initialize iterator;
            for (var t in counts[team]) {
                $("td." + t, panel).text(counts[team][t]);
            }
            var val = ((hq[team] ? hq[team].energon : 0) / 500) * 100;
            var color = Util.toCSSColor(Math.floor(this.getHealthColor(val/100)));
            $("div.energon", panel).css({width: val + "%", backgroundColor: color});
            var inner = $(".teamPower", panel);
            var max = inner.data("maxPower") || 100;
            var power = Math.floor(this.matchState.power[team]);
            if (power > max) {
                max = power;
                inner.data("maxPower", max);
            }
            var pct = Math.floor((power/max)*100);
            inner.css({width: "" + pct + "%"});
            $("span.power-value", panel).text(power);
        }

        this.updateSelectedBotPanel();



    };

    Player.prototype.updateSelectedBotPanel = function () {

        if (this.selectedBot) {
            var bot = this.matchState.robots[this.selectedBot];
            if (bot) {
                $("#selectedBotPanel .botIcon").css({backgroundImage: "url(img/" + bot.type + "-" + bot.team + "-lg.png)", backgroundColor: 'transparent'});
                $('.botIcon .energonOuter', this.selectedBotPanel).show();
                var hpPct = Math.floor((bot.energon / bot.maxEnergon) * 100);
                var color = Util.toCSSColor(Math.floor(this.getHealthColor(hpPct/100)));
                $("#selectedBotPanel .energon").css({width: hpPct + "%", backgroundColor: color});
                $("#selectedBotPanel h1").text("#" + bot.id + "[" + Util.titleCase(bot.type) + "]");

                $(".indicatorStrings", this.selectedBotPanel)
                    .empty()
                    .append("<span>" + bot.indicatorStrings[0] + "</span><br/>")
                    .append("<span>" + bot.indicatorStrings[1] + "</span><br/>")
                    .append("<span>" + bot.indicatorStrings[2] + "</span>");

                var attackingStr = "";
                var x, y, v;
                for (var k in bot.attacking) {
                    v = parseInt(k);
                    x = v % this.match.mapWidth;
                    y = Math.floor(v / this.match.mapWidth);
                    if (bot.attacking[k]) {
                        attackingStr += "(" + x + "," + y + "), ";
                    }
                }

                if (attackingStr.length > 2 && attackingStr.substring(attackingStr.length-2) == ', ') {
                    attackingStr = attackingStr.substring(0, attackingStr.length-2);
                }

                var lines = [
                    "Position: " + bot.pos.x + ", " + bot.pos.y
                ];

                if (bot.action) {
                    lines.push(bot.action + ": " + (bot.actionRoundsTotal-(bot.actionRounds-1)) + "/" + bot.actionRoundsTotal);
                }
                if (attackingStr) {
                    lines.push("Attacking: " + (attackingStr));
                }

                if (bot.shields > 0) {
                    lines.push("Shields: " + bot.shields);
                }
                lines.push("Bytecodes Used: " + bot.bytecodesUsed);
                $(".details", this.selectedBotPanel).html(
                    lines.join("<br />")
                );
                if (bot.isDead) {
                    $('.botIcon', this.selectedBotPanel).css({backgroundColor: "#FF6666"});
                }
            } else {
                $('.botIcon .energon', this.selectedBotPanel).css({width: "0%"});
                $('.botIcon', this.selectedBotPanel).css({backgroundColor: "#FF6666"});
            }
        }

    };

    Player.prototype.applyMatchState = function (state, animate) {
        var ev, cb;
        for (i=0; i<state.delta.length; i++) {
            ev = state.delta[i];
            cb = this['apply_' + ev.event];
            if (cb) {
                cb.call(this, ev, animate);
            }
        }

    };

    Player.prototype.undoMatchState = function (state, animate) {
        var ev, cb;
        for (i=0; i<state.delta.length; i++) {
            ev = state.delta[i];
            cb = this['undo_' + ev.event];
            if (cb) {
                cb.call(this, ev, animate);
            }
        }
    };

    /**
     * state appliers
     */

    Player.prototype.apply_spawn = function (ev, animate) {
        var bot = new PIXI.Sprite(this.textures[ev.bot.team.toLowerCase()][ev.bot.type.toLowerCase()]);
        bot.id = ev.bot.id;
        bot.interactive = true;
        bot.on('mousedown', this.onBotClick.bind(this));
        bot.anchor.x = 0.5;
        bot.anchor.y = 0.5;
        bot.pivot.x = 0.5;
        bot.pivot.y = 0.5;
        bot.width = this.botSize;
        bot.height = this.botSize;
        bot.location = ev.bot.pos;
        bot.position = this.getCellCenter(ev.bot.pos);
        bot.rotation = ev.bot.dir;
        this.botSprites[ev.bot.id] = bot;
        this.botLayer.addChild(bot);
    };

    Player.prototype.undo_spawn = function (ev, animate) {
        this.botLayer.removeChild(this.botSprites[ev.bot.id]);
        delete this.botSprites[ev.bot.id];
    };

    Player.prototype.apply_research = function (ev, animate) {
        var p = $("#team-stats-" + ev.team + " .upgrade." + ev.upgrade + " progress");
        var max = parseInt(p.attr("max"));
        if (max == ev.value) {
            p.addClass("complete");
        } else if (ev.value == 1) {
            p.parent().show();
        }
        p.attr("value", ev.value);
    };

    Player.prototype.undo_research = function (ev, animate) {
        console.log("Undoing research event", ev);
        var p = $("#team-stats-" + ev.team + " .upgrade." + ev.upgrade + " progress");
        var max = parseInt(p.attr("max"));
        if (max == parseInt(p.attr("value"))) {
            p.removeClass("complete");
        } else if (parseInt(p.attr("value")) == 1) {
            p.parent().hide();
        }

        p.attr("value", ev.value-1);
    };

    Player.prototype.apply_regen = Player.prototype.undo_regen = function (ev, animate) {
        if (animate) {
            this.effectsLayer.lineStyle(0, 0);
            this.effectsLayer.beginFill(0x66FF66, 0.5);
            var pos = this.getCellCenter(ev.loc);
            this.effectsLayer.drawCircle(pos.x, pos.y, this.cellSize * 1.5);
            this.effectsLayer.endFill();
        }
    };

    Player.prototype.apply_shield = Player.prototype.undo_shield = function (ev, animate) {
        if (animate) {
            this.effectsLayer.lineStyle(0, 0);
            this.effectsLayer.beginFill(0x66FFFF, 0.5);
            var pos = this.getCellCenter(ev.loc);
            this.effectsLayer.drawCircle(pos.x, pos.y, this.cellSize * 1.5);
            this.effectsLayer.endFill();
        }
    };

    Player.prototype.apply_attack = Player.prototype.undo_attack = function (ev, animate) {

        var bot = this.matchState.robots[ev.botId];
        if (bot === undefined) {
            console.log("Couldn't find attacking bot");
        }

        if (bot.type == 'artillery') {
            var color = bot.team == 'a' ? 0xFF6666 : 0x6666FF;
            this.effectsLayer.lineStyle(this.cellSize < 16 ? 2 : 3, color, 0.5);
            var src = this.getCellCenter(bot.pos);
            var x = ev.target % this.match.mapWidth;
            var y = Math.floor(ev.target / this.match.mapWidth);
            var dest = this.getCellCenter({x: x, y: y});
            console.log("Drawing artliiery Fire (" + bot.pos + ") -> (" + ev.target + ")");
            this.effectsLayer.moveTo(src.x, src.y);
            this.effectsLayer.lineTo(dest.x, dest.y);
            this.effectsLayer.beginFill(color, 0.5);
            this.effectsLayer.drawCircle(dest.x, dest.y, this.cellSize * 1.5)
            this.effectsLayer.endFill();
        }
    };

    Player.prototype.apply_death = function (ev, animate) {
        this.botLayer.removeChild(this.botSprites[ev.bot.id]);
        if (animate) {
            this.createExplosion(ev.bot.pos);

        }
    };

    Player.prototype.undo_death = function (ev, animate) {
        this.botLayer.addChild(this.botSprites[ev.bot.id]);
        if (animate) {
            this.createExplosion(ev.bot.pos);
        }
    };

    Player.prototype.apply_removeDead = function (ev, animate) {
        var bot = this.botSprites[ev.bot.id];
        delete this.botSprites[ev.bot.id];
        this.botLayer.removeChild(bot);
        bot.destroy();
    };

    Player.prototype.undo_removeDead = function (ev, animate) {
        var bot = new PIXI.Sprite(this.textures[ev.bot.team.toLowerCase()][ev.bot.type.toLowerCase()]);
        bot.interactive = true;
        bot.on('mousedown', this.onBotClick.bind(this));
        bot.id = ev.bot.id;
        bot.anchor.x = 0.5;
        bot.anchor.y = 0.5;
        bot.pivot.x = 0.5;
        bot.pivot.y = 0.5;
        bot.width = this.cellSize;
        bot.height = this.cellSize;
        bot.location = ev.bot.pos;
        bot.position = this.getCellCenter(ev.bot.pos);
        bot.rotation = ev.bot.dir;
        this.botSprites[ev.bot.id] = bot;
        this.botLayer.addChild(bot);
    };

    Player.prototype.apply_move = function (ev, animate) {
        var botSprite = this.botSprites[ev.botId];
        if (animate) {
            TweenLite.to(botSprite.position, this.frameDuration/1000, this.getCellCenter(ev.to));
        } else {
            botSprite.position = this.getCellCenter(ev.to);
        }
        botSprite.rotation = ev.dir;
    };

    Player.prototype.undo_move = function (ev, animate) {
        var botSprite = this.botSprites[ev.botId];
        if (botSprite) {
            if (animate) {
                TweenLite.to(botSprite.position, this.frameDuration / 1000, this.getCellCenter(ev.from));
            } else {
                botSprite.position = this.getCellCenter(ev.from);
            }
            botSprite.rotation = ev.dir;
        }
    };

    Player.prototype.apply_defuseMine = function (ev, animate) {
        var botSprite = this.botSprites[ev.botId];
        if (botSprite) {
            botSprite.rotation = ev.dir;
        }
    };

    Player.prototype.undo_defuseMine = function (ev, animate) {
        var botSprite = this.botSprites[ev.botId];
        if (botSprite) {
            botSprite.rotation = ev.dir;
        }
    };

    Player.prototype.apply_energonChange = function (ev, animate) {

    };

    Player.prototype.undo_energonChange = function (ev, animate) {

    };

    Player.prototype.apply_teamPowerChange = function (ev, animate) {
        // TODO: Update Stats Panel
    };

    Player.prototype.undo_teamPowerChange = function (ev, animate) {
        // TODO: Update Stats Panel
    };

    Player.prototype.createExplosion = function (loc) {
        var boom = new PIXI.extras.MovieClip(this.boomFrames);
        this.effectsLayer.addChild(boom);
        boom.position = this.getCellCenter(loc);
        boom.anchor = {x: 0.5, y: 0.5};
        boom.width = this.cellSize * 2;
        boom.height= this.cellSize * 2;
        boom.loop = false;
        boom.on('complete', function () {
            this.effectsLayer.removeChild(boom);
            boom.destroy();
        }.bind(this));
        boom.play();
        //var cfg = $.extend({}, this.explosionConfig);
        //cfg.emitterLifetime = this.frameDuration / 1000.0;
        //var emitter = new cloudkid.Emitter(
        //    this.botLayer,
        //    [PIXI.Texture.fromImage('img/particle.png')],
        //    this.explosionConfig);
        //var pos = this.getCellCenter(loc);
        //emitter.updateOwnerPos(pos.x, pos.y);
        //emitter.emit = true;
        //emitter.resetPositionTracking();
        //this.roundEmitters.push(emitter);
    };

    Player.prototype.createArtilleryShell = function (from, to) {
        var cfg = $.extend({}, this.artilleryShellConfig);
        cfg.emitterLifetime = this.frameDuration / 1000.0;
        var emitter = new cloudkid.Emitter(
            this.botLayer,
            [PIXI.Texture.fromImage('img/particle.png')],
            cfg);
        var pos = this.getCellCenter(from);
        var pos2 = this.getCellCenter(to);
        emitter.updateOwnerPos(pos.x, pos.y);
        emitter.emit = true;
        emitter.resetPositionTracking();

        TweenLite.to(pos,
            this.frameDuration / 1000.0, {
                x: pos2.x, y: pos2.y,
                onUpdate: function () {
                    if (emitter.ownerPos != null) {
                        emitter.updateOwnerPos(pos.x, pos.y);
                    }
                }
            }
        );

        //this.roundEmitters.push(emitter);
    };

    Player.prototype.getCellCenter = function (pt) {
        return {x: (this.cellSize * pt.x) + (this.cellSize/2),
                y: (this.cellSize * pt.y) + (this.cellSize/2)};
    };

    Player.prototype.getHealthColor = function (pct) {
        var g = Math.floor(Math.min(255, pct * 510));
        var r = Math.floor(Math.min(255, 510 - (pct * 510)));
        return 256 * 256 * r + 256 * g;
    };

    var sprite, bot, sel;
    Player.prototype.updateStatusLayer = function (pct) {
        this.statusLayer.clear();

        if (this.selectedBot) {
            this.statusLayer.lineStyle(0,0,0);
            sel = this.botSprites[this.selectedBot];
            if (sel) {
                this.statusLayer.beginFill(0xFFCC00, 0.75);
                this.statusLayer.drawRect(sel.x - this.halfBotSize, sel.y - this.halfBotSize, this.botSize, this.botSize);
                this.statusLayer.endFill();
            }
        }


        if (this.matchState) {
            this.statusLayer.lineStyle(2, 0x000000, 0.8);
            for (bk in this.matchState.robots) {
                sprite = this.botSprites[bk];
                bot = this.matchState.robots[bk];
                if (bot.action) {
                    this.statusLayer.moveTo(sprite.position.x - this.halfBotSize + 1, sprite.position.y + this.halfBotSize - 2);
                    this.statusLayer.lineTo(sprite.position.x + this.halfBotSize - 1, sprite.position.y + this.halfBotSize - 2);
                }
                this.statusLayer.moveTo(sprite.position.x - this.halfBotSize + 1, sprite.position.y + this.halfBotSize);
                this.statusLayer.lineTo(sprite.position.x + this.halfBotSize - 1, sprite.position.y + this.halfBotSize);

            }
            var hp;
            for (bk in this.matchState.robots) {
                bot = this.matchState.robots[bk];
                sprite = this.botSprites[bk];
                this.statusLayer.lineStyle(2, this.getHealthColor(bot.energon / bot.maxEnergon), 0.8);
                this.statusLayer.moveTo(sprite.position.x - this.halfBotSize + 1,
                                        sprite.position.y + this.halfBotSize);
                this.statusLayer.lineTo(sprite.position.x - this.halfBotSize + 1 + ((bot.energon / bot.maxEnergon) * (this.botSize - 2)),
                                        sprite.position.y + this.halfBotSize);
                if (bot.action) {
                    this.statusLayer.lineStyle(2, 0x00AAFF, 0.8);
                    this.statusLayer.moveTo(sprite.position.x - this.halfBotSize + 1,
                                            sprite.position.y + this.halfBotSize - 2);
                    this.statusLayer.lineTo(sprite.position.x - this.halfBotSize + 1 + (((bot.actionRoundsTotal - bot.actionRounds) / bot.actionRoundsTotal) * (this.botSize - 2)),
                                            sprite.position.y + this.halfBotSize - 2);
                }
            }
        }
    };

    Player.prototype.animate = function (elapsed) {

        if (this.paused) {
            this.lastElapsed = elapsed;
            //elapsed = this.lastElapsed;
        }

        if (this.lastElapsed == 0) {
            this.lastElapsed = elapsed;
        }

        var delta = (elapsed - this.lastElapsed);
        //console.log(delta);
        if (!this.paused) {
            this.frameTime += (delta);
        }

        this.lastElapsed = elapsed;

        while (this.frameTime > this.frameDuration) {
            this.frameTime -= this.frameDuration;
            if (!this.paused) {
                this.transitionToRound(this.round + 1);
            }

        }

        this.updateStatusLayer();

        this.renderer.render(this.stage);
        if (!this.playbackComplete) {
            requestAnimationFrame(this.animate.bind(this));
        }
    };

    Player.prototype.renderMap = function () {

        this.field.clear();
        this.field.beginFill(0xe0e0e0);
        this.field.drawRect(0, 0, this.boardWidth, this.boardHeight);

        this.field.endFill();
        if (this.matchState) {
            this.field.beginFill(MINE_NEUTRAL);
            this.renderMineList(this.matchState.mines.neutral);
            this.field.endFill();

            this.field.beginFill(MINE_A);
            this.renderMineList(this.matchState.mines.a);
            this.field.endFill();

            this.field.beginFill(MINE_B);
            this.renderMineList(this.matchState.mines.b);
            this.field.endFill();

            this.field.beginFill(0, 0);
            this.field.lineStyle(1, 0x009900, 0.8);

            // render encampments.
            var mine, gx, gy, px, py;
            for (var mine in this.matchState.encampments) {
                gx = mine % this.match.mapWidth;
                gy = Math.floor(mine / this.match.mapWidth);
                px = (this.cellSize * gx);
                py = (this.cellSize * gy);
                this.field.drawRect(px + 1, py + 1, this.cellSize - 2, this.cellSize - 2);
                this.field.drawRect(px + 3, py + 3, this.cellSize - 6, this.cellSize - 6);
                if (this.cellSize > 10) {
                    this.field.drawRect(px + 5, py + 5, this.cellSize - 10, this.cellSize - 10)
                }
                if (this.cellSize > 14) {
                    this.field.drawRect(px + 7, py + 7, this.cellSize - 14, this.cellSize - 14)
                }
            }
        }
    };
    window.Player = Player;
});