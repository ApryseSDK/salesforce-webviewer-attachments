public class ContentVersionPayload {
    public String title {get; set;}
    public String filename {get; set;}
    public String base64Data {get; set;}
    public String contentDocumentId {get; set;}

    public static ContentVersionPayload parse(String json) {
        return (ContentVersionPayload) System.JSON.deserialize(json, ContentVersionPayload.class);
    }
}