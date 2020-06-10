interface Transcription {
  text: string;
  words: string[];
}

const response: Transcription = {
  text: "hello world",
  words: ["wow cool"],
};

console.log(response);
