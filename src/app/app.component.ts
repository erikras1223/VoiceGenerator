import { AfterViewInit, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { Queue } from './util/queue';


declare var $: any;
interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, AfterViewInit {
  title = 'VoiceSecured';
  private recognition: SpeechRecognition;
  public noteTextarea = '';
  public instructions = 'Press the Start Recognition button and allow access.';
  private currentLine = '';
  private noteContent = '';
  public notesList: any[] = [];
  private speechSynthesis: SpeechSynthesis;
  private utterInstances: SpeechSynthesisUtterance;
  public speechCustom: string;
  public suffix = '';
  public listenAfterSpeechSwitch = true;

  public filler = '';
  public isFemale: boolean = true;
  public models: string[] = ['124M', '355M', '774M', '1558M']; 

  private speechUtteranceChunker = null;
  private speechQueue: Queue;
  private timeLastSpoke: number;
  private listenAfterSpeechSubject: Subject<any> = new Subject();
  private readonly fillerSpeechList: string[] = [
    'now, now don\'t be hasty',
    'Please hold on, I need your help',
    'Do you trust me?',
    'I have faith in you, can you take a leap of faith on me',
    'Well that is just plain rude',
    'Jimmy The Cricket your a quick one!',
    'Thanks, that is sure nice of you to say',
    'Did you get that on sale its so cute',
    'Oh rusty buckets, you\'re going to catch a fever out there',
    "Who told you that about me. I am very nice and a kind person"
  ];
  public configParams: any  = {
    model_name: "774M",
    input_text: ""
  }
  

  constructor(private cdRef: ChangeDetectorRef,
    private http: HttpClient) {
    this.speechQueue = new Queue();
    let _speechUtteranceChunker: any = (utt, settings, callback) => {
      settings = settings || {};
      var newUtt;
      var txt = (settings && settings.offset !== undefined ? utt.text.substring(settings.offset) : utt.text);
      if (utt.voice && utt.voice.voiceURI === 'native') { // Not part of the spec
        newUtt = utt;
        newUtt.text = txt;
        newUtt.addEventListener('end', function () {
          if (_speechUtteranceChunker.cancel) {
            _speechUtteranceChunker.cancel = false;
          }
          if (callback !== undefined) {
            callback();
          }
        });
      }
      else {
        let chunkLength = (settings && settings.chunkLength) || 160;
        let pattRegex = new RegExp('^[\\s\\S]{' + Math.floor(chunkLength / 2) + ',' + chunkLength + '}[.!?,]{1}|^[\\s\\S]{1,' + chunkLength + '}$|^[\\s\\S]{1,' + chunkLength + '} ');
        let chunkArr = txt.match(pattRegex);

        if (chunkArr[0] === undefined || chunkArr[0].length <= 2) {
          //call once all text has been spoken...
          if (callback !== undefined) {
            callback();
          }
          return;
        }
        let chunk = chunkArr[0];
        newUtt = new SpeechSynthesisUtterance(chunk);

        for (let x in utt) {
          if (utt[x] && x !== 'text') {
            newUtt[x] = utt[x];
          }
        }
        newUtt.addEventListener('end', function () {
          if (_speechUtteranceChunker.cancel) {
            _speechUtteranceChunker.cancel = false;
            return;
          }
          settings.offset = settings.offset || 0;
          settings.offset += chunk.length - 1;
          _speechUtteranceChunker(utt, settings, callback);
        });
      }

      if (settings.modifier) {
        settings.modifier(newUtt);
      }
      console.log(newUtt); //IMPORTANT!! Do not remove: Logging the object out fixes some onend firing issues.
      //placing the speak invocation inside a callback fixes ordering and onend issues.
      setTimeout(function () {
        speechSynthesis.speak(newUtt);
      }, 0);
    };
    this.speechUtteranceChunker = _speechUtteranceChunker;
  }


  ngOnInit() {
    const { webkitSpeechRecognition }: IWindow = window as unknown as IWindow;
    let vulgarities = ["shit", "fuck", "bitch", "damn", "jesus", "christ", "god", "pussy", "dick", "douche", "bastard", "gay", "nigger", "homo"]
    this.speechSynthesis = (window as any).speechSynthesis;
    this.utterInstances = new SpeechSynthesisUtterance();
    this.listenAfterSpeechSubject.subscribe((event) => {
      console.log('I stopped speaking.. starting listening');
      if (this.listenAfterSpeechSwitch) {
        this.recognition.start();
      }
    });

    setInterval(() => {
      if (!this.speechSynthesis.speaking && !this.speechQueue.isEmpty()) {
        let message: string = this.speechQueue.pop();
        message = message.toLowerCase()
        for (let vulgar of vulgarities) {
          let index = message.indexOf(vulgar);
          if (index > -1) {
            let re = new RegExp(vulgar, "g");
            message = message.replace(re, "beep");
          }
        }
        this.readOutLoud(message, false);
      }
      // } else {
      //   let  now = performance.now();
      //   if((now - this.timeLastSpoke) > 18500 ){
      //     //are you there, stay here I love you"

      //     this.generateFillerSpeech(null);
      //     setTimeout(() => {
      //       this.timeLastSpoke = performance.now();
      //     },2000)
      //   }
      // }
    }, 2000);




    // this.speechRecognition = SpeechRecognition;
    try {
      this.recognition = new webkitSpeechRecognition();
    } catch (e) {
      console.error(e);
    }
    const notes = this.getAllNotes();
    // this.renderNotes(notes);
    /*-----------------------------
      Voice Recognition
------------------------------*/

    // If false, the recording will stop after a few seconds of silence.
    // When true, the silence period is longer (about 15 seconds),
    // allowing us to keep recording even when the user pauses.
    this.recognition.continuous = false;

    // This block is called every time the Speech APi captures a line.


    this.recognition.onresult = (event: SpeechRecognitionEvent) => {

      // event is a SpeechRecognitionEvent object.
      // It holds all the lines we have captured so far.
      // We only need the current one.
      this.timeLastSpoke = performance.now();
      const current = event.resultIndex;
      console.log(event.results);

      // Get a transcript of what was said.
      const transcript = event.results[current][0].transcript;
      this.currentLine = transcript;
      console.log('This is the transcript: ' + transcript);
      console.log('This is the event result ' + event.results);

      const wordList = this.currentLine.split(' ');
      let scramberList = [];
      let tempSuffix = this.suffix;
      for (let i = 0; i < wordList.length; i++) {
        if (i % 2 === 0) {
          scramberList.push(wordList[i] + tempSuffix);
        } else {
          scramberList.push(wordList[i]);
        }

      }

      let scrambledStr = scramberList.join(' ');

      // setTimeout(() => {
      //   this.readOutLoud(scrambledStr, false);
      // }, 1600 );


      // Add the current transcript to the contents of our Note.
      // There is a weird bug on mobile, where everything is repeated twice.
      // There is no official solution so far so we have to handle an edge case.
      const mobileRepeatBug = (current === 1 && transcript === event.results[0][0].transcript);
      this.currentLine = transcript;
      if (!mobileRepeatBug) {
        this.noteContent += ' ' + transcript;
        this.noteTextarea = this.noteContent + "<br>";
        this.cdRef.detectChanges();
      }
      this.configParams.input_text = this.currentLine;
      this.generateResponse().subscribe(resp => {
        this.requestSpeech(resp);
        //this.readOutLoud(resp, false);
      });


    };

    this.recognition.onstart = () => {
      this.instructions = 'Voice recognition activated. Try speaking into the microphone.';
    };

    this.recognition.onspeechend = (event) => {
      console.log(event);
      this.instructions = 'You were quiet for a while so voice recognition turned itself off.';
      this.cdRef.detectChanges();
      this.recognition.stop();
      console.log('I stopped listening');

      setTimeout(() => {
        this.recognition.start();
      }, 2000)


    };

    this.recognition.onerror = (event) => {
      if (event.error === 'no-speech') {
        this.instructions = 'No speech was detected. Try again.';
      }
    };


    console.log(this.speechSynthesis);

  }


  ngAfterViewInit(): void {
    this.timeLastSpoke = performance.now();
  }

  generateResponse(): Observable<any> {
    let params = new HttpParams()
    for(let key in this.configParams){
      params = params.set(key, this.configParams[key]);
    }
    return this.http.get("/text-generate", { params: params })

  }

  startRecord(event: any) {
    console.log('look hello');
    if (this.noteContent.length) {
      this.noteContent += ' ';
    }
    this.cdRef.detectChanges();
    this.recognition.start();
  }
  pauseRecord(event: any) {
    this.recognition.stop();
    this.instructions = 'Voice recognition paused.';
    this.cdRef.detectChanges();
  }
  saveRecord(event: any) {
    this.recognition.stop();

    if (!this.noteContent.length) {
      this.instructions = 'Could not save empty note. Please add a message to your note.';
    } else {
      this.saveNote(new Date().toLocaleString(), this.noteContent);
      this.noteContent = '';

    }
    this.cdRef.detectChanges();
  }

  saveNote(dateTime, content) {
    localStorage.setItem('note-' + dateTime, content);
  }

  onTextGen(event) {
    this.recognition.stop();
    this.readOutLoud(event, false);
  }


  getAllNotes() {
    const notes = [];
    let key;
    for (let i = 0; i < localStorage.length; i++) {
      key = localStorage.key(i);

      if (key.substring(0, 5) === 'note-') {
        notes.push({
          date: key.replace('note-', ''),
          content: localStorage.getItem(localStorage.key(i))
        });
      }
    }
    return notes;
  }
  speakFromText(event): void {
    // this.recognition.stop();
    // this.readOutLoud(this.speechCustom, true);
    this.requestSpeech(this.speechCustom)
  }

  readOutLoud(message: string, selfInitiated: boolean): any {
    // Set the text and voice attributes.
    // tslint:disable-next-line:no-unused-expression
    this.recognition.stop();
    this.utterInstances.voice = this.isFemale ? this.speechSynthesis.getVoices()[3] : this.speechSynthesis.getVoices()[5];
    this.utterInstances.text = message;
    this.utterInstances.volume = 1;
    this.utterInstances.rate = 0.7;
    this.utterInstances.pitch = 0.2;
    this.speechUtteranceChunker(this.utterInstances, { chunchLength: 120 }, () => { this.listenAfterSpeechSubject.next(null) });

    //return this.speechSynthesis.speak(this.utterInstances);
  }
  generateFillerSpeech(event): void {
    const len: number = this.fillerSpeechList.length;
    const index: number = Math.floor(Math.random() * len);

    this.utterInstances.voice = this.speechSynthesis.getVoices()[5];
    this.filler = this.fillerSpeechList[index];
    this.requestSpeech(this.filler);
    // this.utterInstances.text = this.filler;
    // this.utterInstances.volume = 1;
    // this.utterInstances.rate = 0.7;
    // this.utterInstances.pitch = 0.8;
    // return this.speechSynthesis.speak(this.utterInstances);
  }

  requestSpeech(message) {
    if (message) {
      this.speechQueue.push(message);
    }
  }



}
