import axios from "axios";

const options = {
  method: "POST",
  url: "https://api.edenai.run/v2/text/generation",
  headers: {
    authorization:
      "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiYzkxYTM4ZGEtMzg5MC00ZDBkLWI5N2EtYjM0NWQ1OTdjN2Q5IiwidHlwZSI6ImFwaV90b2tlbiJ9.hQQ3HX4T770aw3A0dcfbaOT6WJ6g7GG-2r70HA6cCSI",
  },
  data: {
    providers: "openai",
    text: "I will post a picture of the Premier League's standings after round 20 on twitter. need a unique tweet to promote this.",
    temperature: 0.2,
    max_tokens: 250,
    fallback_providers: "",
  },
};

axios
  .request(options)
  .then((response) => {
    console.log(response.data);
  })
  .catch((error) => {
    console.error(error);
  });
