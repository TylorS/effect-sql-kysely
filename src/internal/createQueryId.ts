// Create a unique query ID, based on kysely's implementation when you don't need to use the executor directly
export function createQueryId() {
  return randomString(8);
}

// Our alphabet for generating random strings
const CHARS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
  "j",
  "k",
  "l",
  "m",
  "n",
  "o",
  "p",
  "q",
  "r",
  "s",
  "t",
  "u",
  "v",
  "w",
  "x",
  "y",
  "z",
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
];

// Generate a random string of a given length
function randomString(length: number) {
  let chars = "";
  for (let i = 0; i < length; ++i) {
    chars += randomChar();
  }
  return chars;
}

// Select a random character from our alphabet
function randomChar() {
  return CHARS[~~(Math.random() * CHARS.length)];
}
