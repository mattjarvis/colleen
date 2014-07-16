var ZN = ZN || { };

ZN.App = function () {

    this.model = null;
    this.rules = null;
    this.nbody = null;

    this.xhr = null;
    this.timeoutTime = 60 * 1000;
    this.timeoutCount = 0;
    this.bLoadData = true;
    this.dataType = "json";
    this.apiUrl = "";
    this.dataSource = "archive"; // "live"
    this.archiveStartSecs = 120000;//2*24*60*60; // seconds
    this.ruleFile = "project_rules";

    this.nextRequestTime = 0;
    this.curTime = 0;
    this.lastTime = 0;
    this.frameTime = 50; // frame ms
    this.requestDuration = 60*1000; // in ms
    this.firstFrame = true;
    this.classificationDelay = 0;
    this.classificationLoadCount = 0;

    this.timeSeriesRequestInterval = 2*60*1000; // in ms

    this.canvasContainerId = "canvas-container";
    this.renderer = null;
    this.rendererType = "canvas"; //"snap";//"raphael" //

    this.paper = null;
    this.paths = [];
    this.frameDurations = [];

    this.debug = true;


}

ZN.App.prototype = {
    constructor:ZN.App,

    init:function(){
        this.model = new ZN.Model();
        this.model.init();
        this.rules = new ZN.Rules();
        this.rules.init(this,this.model);

        var rules = this.getParameterByName("rules");
        if(rules!=""){
            this.ruleFile += "_" + rules;
        }

        this.loadConfig();



    },


    loadConfig:function () {
        var self = this;
        var url = "js/config.js";

        $.ajax({
            type:"GET",
            url:url,
            dataType:"script",
            success:function (data) {
                self.configLoaded();
            },
            error:function (xhr, status, error) {
                //if (xhr.status != 404) {alert(error);} else {alert("404 config not found");}
            }
        })
    },

    configLoaded:function(){
	// url for api on same host as this page served from
	//	var url = window.location.protocol + "//" + window.location.host + "/"; 
	    var url = 'http://localhost:5000/'
        this.apiUrl = url;
        this.dataSource = ZN.config.dataSource;
        this.loadProjectRules();

    },

    loadUrl:function (url, type, callback) {

        var self = this;

        this.xhr = $.ajax({
            url:url,
            dataType:type,
            contentType:"application/x-www-form-urlencoded;charset=uft-8",
            success:function (data) {
                self.timeoutCount = 0;
                callback.apply(self,[data]);

            },

            error:function (jqXHR, exception) {

                if (exception === 'abort') {
                    //alert('Ajax request aborted.');

                }
                else if (exception === 'timeout') {
                    //alert('Time out error.');
                    self.timeoutCount += 1;
                    if (self.timeoutCount < 2) {
                        self.loadUrl(this.url, this.dataType, callback);
                    }
                    else {
                        alert('Time out error.');
                    }

                }
                else if (jqXHR.status === 0) {
                    self.timeoutCount += 1;
                    if (self.timeoutCount < 2) {
                        self.loadUrl(this.url, this.dataType, callback);
                    }
                    else {
                        alert('Not Connected.');
                    }
                    //alert('Not connect.\n Verify Network.');
                } else if (jqXHR.status == 404) {
                    alert('Requested page not found. [404]');
                } else if (jqXHR.status == 500) {
                    alert('Internal Server Error [500].');
                } else if (exception === 'parsererror') {
                    alert('Requested JSON parse failed.');
                } else {
                    alert('Uncaught Error.\n' + jqXHR.responseText);
                }

            },
            complete:function (jqXHR, textStatus) {
                /*alert("Load Complete: " + textStatus)*/
            }

        });

    },

    /*
    loadProjects:function () {
        var url = "data/projects.json";
        this.loadUrl(url, "json",this.projectsLoaded);

    },
    projectsLoaded:function(data){
        this.model.initProjects(data);
        this.loadAssets();
    },
    */

    loadProjectRules:function () {
        var url = "data/"+this.ruleFile+".json";

        this.loadUrl(url, "json",this.projectRulesLoaded);

    },
    projectRulesLoaded:function(data){
        this.model.initProjects(data);
        var SECS = this.model.SECS;

        this.loadTimeSeries([SECS.MIN, SECS.MIN5, SECS.MIN15, SECS.HOUR, SECS.DAY]);

    },

    loadProjectAnalytics:function() {
        var url = this.apiUrl+"analytics";
        this.loadUrl(url, "json",this.analyticsLoaded);

    },
    analyticsLoaded:function(data){
        this.model.parseAnalytics(data);
        this.startApp();
        //this.loadClassification();
    },


    loadTimeSeries:function(intervals) {
        var url = this.apiUrl+"timeseries/intervals/"+ intervals.join(',');
        this.loadUrl(url, "json",this.timeSeriesLoaded);

    },
    timeSeriesLoaded:function(data){
        this.model.parseTimeSeries(data);

        this.startApp();
        //this.loadClassification();
    },

    startApp:function(){
        this.initRenderer();
        this.curTime = this.lastTime = (new Date()).valueOf();
        this.initInterface();

        /*
        // init project positions
        this.rules.initProjectLocations();
        // set focus project
        this.rules.setFocusProject();
         */

        var self = this;
        setTimeout(function(){self.loadIncTimeSeries()}, this.timeSeriesRequestInterval);

        this.update();

    },

    initInterface:function(){
        var self = this;
        if(this.debug){
            $(document.body).append('<div id="diagnostics" style="position:absolute;z-index:10;"></div>');
        }

        $(window).resize(function(){
            self.renderer.resize();
        });

    },

    loadClassification:function () {
        var maxItems = 1000;
        var requestDurationSecs = this.requestDuration/1000;
        var offsetSecs = 0;
        if(this.dataSource=="archive"){
            offsetSecs = this.archiveStartSecs-this.classificationLoadCount*requestDurationSecs;
        }
        var url = this.apiUrl + "classifications/" + maxItems +"/duration/"+requestDurationSecs+"/offset/"+offsetSecs;

        this.loadUrl(url, "json", this.classificationLoaded);

    },

    classificationLoaded:function(data){
        var d = data;
        var classifications = this.model.addClassifications(data);
        var delay = (new Date()).valueOf() - classifications[0].time;

        this.classificationLoadCount += 1;

        if(this.firstFrame){
            this.firstFrame = false;
            this.classificationDelay = delay;
            this.nextRequestTime = (new Date()).valueOf() + this.requestDuration;
            this.update();

        }
        else{
            /*
            if(this.classificationDelay < delay){
                this.classificationDelay = delay;
            }
            */
        }


    },

    loadIncTimeSeries:function() {
        var from = this.model.maxSeriesTime + 1;
        var to = this.curTime/1000;
        var url = this.apiUrl+"timeseries/from/"+from+"/to/"+to;
        this.loadUrl(url, "json",this.incTimeSeriesLoaded);

    },
    incTimeSeriesLoaded:function(data){
        this.model.incrementTimeSeries(data);
        var self = this;
        setTimeout(function(){self.loadIncTimeSeries()}, this.timeSeriesRequestInterval);


    },

    resize:function(){

    },

    initRenderer:function(){

        switch(this.rendererType){
            case "raphael":
                this.renderer = new ZN.RaphaelRenderer();
                this.renderer.init(this,this.model,this.canvasContainerId);

                break;
            case "snap":
                this.renderer = new ZN.SnapRenderer();
                this.renderer.init(this,this.model,this.canvasContainerId);

                break;

            case "canvas":
                this.renderer = new ZN.CanvasRenderer();
                this.renderer.init(this,this.model,this.canvasContainerId);

                break;

        }
    },

    update:function(){
        var self = this;
        this.updateFps();

        /*
        // load new classifications
        if(this.curTime>this.nextRequestTime){
            this.loadClassification();
            this.nextRequestTime = this.curTime + this.requestDuration;
            console.log("nextRequestTime",(new Date(this.nextRequestTime)).toISOString());
        }

        // classification
        if(this.model.classifications.length>0){
            var nextClassificationTime = this.model.getNextClassificationTime()+ this.classificationDelay;
            if(this.curTime>nextClassificationTime){
                console.log("nextClassificationTime",(new Date(nextClassificationTime)).toISOString());
                var classification = this.model.removeFirstClassification();
                console.log("classification timestamp:",classification.timestamp);

            }
        }
        */

        var frameTimeTarget = 33; // ms

        var t0 = new Date().valueOf();
        this.rules.update(frameTimeTarget);//this.frameTime);
        this.renderer.render();
        var t1 = new Date().valueOf();
        var dt = t1-t0;



        var timeout = Math.max(frameTimeTarget-dt,0);
        timeout = Math.min(timeout,frameTimeTarget);

        setTimeout(function() {
            requestAnimationFrame(function(){self.update()});

        }, timeout);


    },

    updateFps:function(){
        this.lastTime = this.curTime;
        this.curTime = (new Date()).valueOf();
        var frame = this.curTime - this.lastTime;
        this.frameTime = frame;//Math.max(frame,33);
        this.frameDurations.push(frame);
        if(this.frameDurations.length>10) this.frameDurations.shift();

        var sum = this.frameDurations.reduce(function(prev, cur, index, array){
            return prev + cur;
        });
        var fps = (1.0/((sum/this.frameDurations.length)/1000)).toFixed(2) + " fps";
        if(this.debug){
            $("#diagnostics").html(fps);
        }

    },



    getParameterByName:function(name){
        name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
        var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
            results = regex.exec(location.search);
        return results == null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
    }


}
