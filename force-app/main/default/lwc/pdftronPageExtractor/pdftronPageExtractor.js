import { LightningElement, track, wire } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';
import { fireEvent } from 'c/pubsub';

export default class PdftronPageExtractor extends LightningElement {
    
    @wire(CurrentPageReference) pageRef;
    @track fileName = 'myfile.pdf';
    @track pageRange;

    handleNameChange(event) {
        this.fileName = event.target.value;
    }

    handlePageChange(event) {
        this.pageRange = event.target.value;
    }

    handleDownload() {
        if(!this.pageRange) return;

        this.pageRange = this.pageRange.replace( /\s/g, ''); //remove whitespace
        let stringArray = this.pageRange.split(','); //split by commas

        //regexes to check for single page or page range
        const regexRange = new RegExp('^(\\d+)-(\\d+)$');
        const regexSingle = new RegExp('^\\d+$');

        let pageArray = [];

        stringArray.forEach((index) => {
            console.log('index', index);
            if(regexSingle.test(index)) {
                console.log("single page, page no: ", index)
                //single page
                let pageNumber = this.parseNumber(index);
                if(pageArray.includes(pageNumber)) {
                    return;
                }
                pageArray.push();
            } else if (regexRange.test(index)) {
                console.log("page range", index)
                //page range
                let currentRangeArray = index.split('-'); //split by dashes
                console.log('currentRangeArray', currentRangeArray);
                let start = this.parseNumber(currentRangeArray[0]);
                let end = this.parseNumber(currentRangeArray[1]);

                let pageNumberArray = [];
                for(let i = start; i <= end; i++ ) {
                    console.log('i', i);
                    pageNumberArray.push(i);
                    if(pageArray.includes(pageNumber)) {
                        console.log('already contains pagenumber: ', pagenumber);
                        return;
                    }
                    pageArray.push(pageNumber);
                }

            } else {
                console.log("invalid", index);
            }
        });

        let payload = {
            fileName: this.fileName,
            pageArray: pageArray
        }

        pageArray.forEach(page => {
            console.log('page', page);
        });

        console.log('payload', payload);
        //fireEvent(this.pageRef, 'extractPage', payload);
    }

    parseNumber(x) { //parse int from string
        const parsed = parseInt(x, 10);
        if (isNaN(parsed)) { return undefined; }
        return parsed;
    }

    range(start, end) {
        let result = [];
        for(let i = start; i <= end; i++ ) {
            result.push(i);
        }

        return result;
    }
}